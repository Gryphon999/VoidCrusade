/**
 * Voice pack generator: npm run voice
 *
 * Records every voice line (the `vo.*` and `tut.*.vo` keys of both dictionaries) for every speaker
 * that can say it, then runs each take through that speaker's effect chain (helmet vox, gas mask,
 * vehicle intercom, command hall) and writes `public/voice/<lang>/<speaker>/<key>.<n>.mp3` plus
 * `public/voice/manifest.json`. The game plays these files and falls back to the browser's speech
 * synthesis for any line whose recording is missing or out of date.
 *
 *   npm run voice                     record what is missing or changed
 *   npm run voice -- --force          re-process everything (raw takes stay cached)
 *   npm run voice -- --only=commander one speaker
 *   npm run voice -- --check          verify the pack against the dictionaries, write nothing
 *
 * Needs `ffmpeg` on PATH and a speech engine:
 *   - VOICE_ENGINE=edge (default): the `edge-tts` command. Set VOICE_TTS_CMD when it lives
 *     elsewhere, e.g. `wsl -e /home/me/.local/bin/edge-tts`.
 *   - VOICE_ENGINE=elevenlabs: needs ELEVENLABS_API_KEY and the voice ids in ELEVEN_VOICES below.
 *   - VOICE_ENGINE=azure: Azure Speech (licensed for commercial use, native Russian voice). Needs
 *     AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (e.g. westeurope) from a Speech resource.
 *
 * Raw takes are cached in `.voice-cache/`, so changing an effect chain does not record again.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { en } from '../src/i18n/en';
import { ru } from '../src/i18n/ru';
import { Speaker, VoiceLang, VoiceManifest, isVoiceKey, speakersFor, voiceFile, voiceHash, voiceId } from '../src/systems/VoiceCast';

// Optional local secrets (AZURE_SPEECH_KEY=..., one per line); the file is git-ignored.
if (existsSync('.env.voice')) {
  for (const line of readFileSync('.env.voice', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const OUT = 'public';
const CACHE = '.voice-cache';
const DICTS: Record<VoiceLang, Record<string, string>> = { en, ru };

type Mood = 'calm' | 'firm' | 'shout';

interface Actor {
  /** Speech engine voice per language. */
  voice: Record<VoiceLang, string>;
  /** Base delivery: speaking rate in percent and pitch in Hz, added to the mood's own. */
  rate: number;
  pitch: number;
  /** Pitch factor applied after recording (below 1 is deeper and larger). */
  shift: number;
  /** Effect chain name. */
  fx: 'hall' | 'vox' | 'mask' | 'intercom' | 'whisper' | 'command';
  /** Distortion drive in dB before the soft clipper. */
  drive: number;
}

/**
 * The cast. English uses native English voices; Russian uses the multilingual voices, because the
 * service does not serve its two Russian-only voices to this kind of client.
 */
const CAST: Record<Speaker, Actor> = {
  commander: { voice: { en: 'en-GB-RyanNeural', ru: 'en-US-AndrewMultilingualNeural' }, rate: -8, pitch: -6, shift: 0.88, fx: 'hall', drive: 3 },
  announcer: { voice: { en: 'en-GB-ThomasNeural', ru: 'en-US-BrianMultilingualNeural' }, rate: 0, pitch: -2, shift: 0.96, fx: 'command', drive: 5 },
  rifleman: { voice: { en: 'en-US-GuyNeural', ru: 'en-AU-WilliamMultilingualNeural' }, rate: 6, pitch: 0, shift: 0.97, fx: 'vox', drive: 8 },
  heavy: { voice: { en: 'en-US-ChristopherNeural', ru: 'de-DE-FlorianMultilingualNeural' }, rate: -4, pitch: -8, shift: 0.86, fx: 'vox', drive: 9 },
  ranger: { voice: { en: 'en-US-RogerNeural', ru: 'fr-FR-RemyMultilingualNeural' }, rate: 10, pitch: 2, shift: 1.0, fx: 'vox', drive: 6 },
  breacher: { voice: { en: 'en-US-SteffanNeural', ru: 'it-IT-GiuseppeMultilingualNeural' }, rate: 0, pitch: -6, shift: 0.9, fx: 'mask', drive: 7 },
  marksman: { voice: { en: 'en-US-EricNeural', ru: 'ko-KR-HyunsuMultilingualNeural' }, rate: -10, pitch: -4, shift: 0.95, fx: 'whisper', drive: 2 },
  engineer: { voice: { en: 'en-US-BrianNeural', ru: 'en-US-BrianMultilingualNeural' }, rate: 2, pitch: 2, shift: 1.02, fx: 'vox', drive: 5 },
  crew: { voice: { en: 'en-US-AndrewNeural', ru: 'en-US-AndrewMultilingualNeural' }, rate: 4, pitch: -2, shift: 0.94, fx: 'intercom', drive: 5 },
};

/**
 * Azure Speech voices. English keeps the cast above (Azure serves the same neural voices). Russian
 * has three native male voices; speakers who share one are told apart by rate, pitch, post-shift
 * and effect chain.
 */
const AZURE_RU_VOICES: Record<Speaker, string> = {
  commander: 'ru-RU-Lev:MAI-Voice-2.1-Flash',
  announcer: 'ru-RU-DmitryNeural',
  rifleman: 'ru-RU-DmitryNeural',
  heavy: 'ru-RU-Grant:MAI-Voice-2.1-Flash',
  ranger: 'ru-RU-Lev:MAI-Voice-2.1-Flash',
  breacher: 'ru-RU-Grant:MAI-Voice-2.1-Flash',
  marksman: 'ru-RU-Lev:MAI-Voice-2.1-Flash',
  engineer: 'ru-RU-DmitryNeural',
  crew: 'ru-RU-Grant:MAI-Voice-2.1-Flash',
};
/** Extra pitch (Hz) per speaker for the Russian voices, on top of the actor's own. */
const AZURE_RU_PITCH: Record<Speaker, number> = {
  commander: -8, announcer: -2, rifleman: 4, heavy: -10, ranger: 8, breacher: -4, marksman: -2, engineer: -6, crew: 4,
};

/** ElevenLabs voice ids per speaker (fill in to use VOICE_ENGINE=elevenlabs). */
const ELEVEN_VOICES: Partial<Record<Speaker, string>> = {};

const MOOD: Record<Mood, { rate: number; pitch: number; volume: number }> = {
  calm: { rate: 0, pitch: 0, volume: 0 },
  firm: { rate: 3, pitch: 2, volume: 10 },
  shout: { rate: 10, pitch: 9, volume: 30 },
};

/** How a line is delivered, read from its punctuation. */
function moodOf(text: string): Mood {
  if (/!/.test(text)) return 'shout';
  return /[?]|^\S+\.$/.test(text) ? 'calm' : 'firm';
}

interface Take {
  lang: VoiceLang;
  speaker: Speaker;
  key: string;
  variant: number;
  text: string;
}

/**
 * Russian speakers whose edge-tts recordings sounded better than the Azure ones (reviewed by ear on
 * 07.10.2026): they keep the edge engine even when VOICE_ENGINE=azure.
 */
const RU_KEEP_EDGE: ReadonlySet<Speaker> = new Set<Speaker>(['heavy', 'crew', 'breacher']);

/** The engine that records a given take: the global one, except for the Russian edge keepers. */
function engineFor(t: Take): string {
  const engine = process.env.VOICE_ENGINE ?? 'edge';
  return engine === 'azure' && t.lang === 'ru' && RU_KEEP_EDGE.has(t.speaker) ? 'edge' : engine;
}

function collect(): Take[] {
  const takes: Take[] = [];
  for (const lang of Object.keys(DICTS) as VoiceLang[]) {
    for (const [key, value] of Object.entries(DICTS[lang])) {
      if (!isVoiceKey(key)) continue;
      const variants = value.split('|');
      for (const speaker of speakersFor(key)) variants.forEach((text, variant) => takes.push({ lang, speaker, key, variant, text }));
    }
  }
  return takes;
}

/** Runs a command; resolves with its stdout (or stderr when `wantErr` is set). */
function run(cmd: string, args: string[], input?: Buffer, wantErr = false): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    p.stdout.on('data', (d: Buffer) => out.push(d));
    p.stderr.on('data', (d: Buffer) => err.push(d));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) reject(new Error(`${cmd} failed (${code}): ${Buffer.concat(err).toString().slice(-600)}`));
      else resolve(Buffer.concat(wantErr ? err : out));
    });
    p.stdin.on('error', () => undefined);
    p.stdin.end(input);
  });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const signed = (n: number, unit: string): string => `${n < 0 ? '-' : '+'}${Math.abs(Math.round(n))}${unit}`;

/** Records one raw take (or returns the cached one). */
async function record(t: Take): Promise<string> {
  const a = CAST[t.speaker];
  const m = MOOD[moodOf(t.text)];
  const engine = engineFor(t);
  const azureRu = engine === 'azure' && t.lang === 'ru';
  const voice = engine === 'elevenlabs' ? ELEVEN_VOICES[t.speaker] : azureRu ? AZURE_RU_VOICES[t.speaker] : a.voice[t.lang];
  if (!voice) throw new Error(`No ${engine} voice for ${t.speaker}`);
  const rate = a.rate + m.rate;
  const pitch = a.pitch + m.pitch + (azureRu ? AZURE_RU_PITCH[t.speaker] : 0);
  const id = createHash('sha1').update([engine, voice, rate, pitch, m.volume, t.text].join('|')).digest('hex').slice(0, 20);
  const file = join(CACHE, `${id}.mp3`);
  if (existsSync(file) && statSync(file).size > 0) return file;
  mkdirSync(CACHE, { recursive: true });
  let audio: Buffer | null = null;
  for (let attempt = 1; attempt <= 4 && !audio; attempt++) {
    try {
      audio = await (engine === 'elevenlabs' ? elevenLabs(voice, t)
        : engine === 'azure' ? azure(voice, t.lang, rate, pitch, m.volume, t.text)
          : edge(voice, rate, pitch, m.volume, t.text));
      if (audio.length < 1000) audio = null;
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(attempt * 1500);
    }
  }
  if (!audio) throw new Error(`No audio for "${t.text}" (${voice})`);
  writeFileSync(file, audio);
  return file;
}

function edge(voice: string, rate: number, pitch: number, volume: number, text: string): Promise<Buffer> {
  const [cmd, ...pre] = (process.env.VOICE_TTS_CMD ?? 'edge-tts').split(' ');
  return run(cmd, [...pre, '--voice', voice, `--rate=${signed(rate, '%')}`, `--pitch=${signed(pitch, 'Hz')}`, `--volume=${signed(volume, '%')}`, '--file', '/dev/stdin'], Buffer.from(text, 'utf8'));
}

const xml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** The free Azure tier allows about 20 requests a minute: requests are spaced across all workers. */
const AZURE_GAP_MS = Number(process.env.AZURE_GAP_MS ?? 3200);
let azureNext = 0;

async function azure(voice: string, lang: VoiceLang, rate: number, pitch: number, volume: number, text: string): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set');
  const slot = Math.max(Date.now(), azureNext);
  azureNext = slot + AZURE_GAP_MS;
  await sleep(slot - Date.now());
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${voice}">`
    + `<prosody rate="${signed(rate, '%')}" pitch="${signed(pitch, 'Hz')}" volume="${signed(volume, '%')}">${xml(text)}</prosody></voice></speak>`;
  return run('curl', ['-sS', '--fail', '-X', 'POST', `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    '-H', `Ocp-Apim-Subscription-Key: ${key}`, '-H', 'Content-Type: application/ssml+xml',
    '-H', 'X-Microsoft-OutputFormat: audio-24khz-96kbitrate-mono-mp3', '-H', 'User-Agent: voidcrusade-voice',
    '--data-binary', '@-'], Buffer.from(ssml, 'utf8'));
}

function elevenLabs(voice: string, t: Take): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  const body = JSON.stringify({ text: t.text, model_id: process.env.ELEVEN_MODEL ?? 'eleven_multilingual_v2', language_code: t.lang, voice_settings: { stability: moodOf(t.text) === 'shout' ? 0.3 : 0.5, similarity_boost: 0.8, style: 0.6 } });
  return run('curl', ['-sS', '--fail', '-X', 'POST', `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, '-H', `xi-api-key: ${key}`, '-H', 'Content-Type: application/json', '--data-binary', '@-'], Buffer.from(body, 'utf8'));
}

const FMT = 'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono';
const TRIM = 'silenceremove=start_periods=1:start_threshold=-58dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-58dB:start_silence=0.05,areverse';

/** Short burst of radio static: the squelch that opens and closes a transmission. */
const squelch = (label: string, dur: number, amp: number): string =>
  `anoisesrc=d=${dur}:c=white:a=${amp}:r=44100,highpass=f=1400,lowpass=f=5200,afade=t=in:d=0.004,afade=t=out:st=${(dur * 0.45).toFixed(3)}:d=${(dur * 0.55).toFixed(3)},${FMT}[${label}]`;

/** The ffmpeg filter graph for one speaker; input is [0:a], output is [out]. */
function graph(a: Actor, mood: Mood, seconds: number): string {
  const drive = a.drive + (mood === 'shout' ? 3 : 0);
  const body = `[0:a]${FMT},${TRIM},rubberband=pitch=${a.shift}:formant=${a.shift < 0.93 ? 'shifted' : 'preserved'}`;
  const grit = `volume=${drive}dB,asoftclip=type=tanh:threshold=0.8,acompressor=threshold=-20dB:ratio=5:attack=3:release=80:makeup=3`;
  const bed = (seconds + 0.4).toFixed(2);
  switch (a.fx) {
    case 'hall':
      // The Commander speaks in the open: a big chest voice and the echo of a vaulted hall.
      return `${body},bass=g=5:f=130,equalizer=f=2800:t=q:w=1.2:g=3,${grit},aecho=0.85:0.55:55|110|190:0.24|0.16|0.09,apad=pad_dur=0.35[out]`;
    case 'command':
      // Fleet command: a clean narrow channel with a quiet carrier and a closing squelch.
      return [
        `${body},highpass=f=240,lowpass=f=4200,equalizer=f=1500:t=q:w=1:g=4,${grit},aecho=0.9:0.4:18:0.18,apad=pad_dur=0.05[v]`,
        squelch('s2', 0.09, 0.22),
        `[v][s2]concat=n=2:v=0:a=1[line]`,
        `anoisesrc=d=${bed}:c=pink:a=0.012:r=44100,highpass=f=500,lowpass=f=3500,${FMT}[hiss]`,
        `[line][hiss]amix=inputs=2:duration=first:normalize=0[out]`,
      ].join(';');
    case 'mask':
      // Breachers talk through a respirator: muffled, boxy, with a short hollow resonance.
      return [
        `${body},highpass=f=200,lowpass=f=2300,equalizer=f=850:t=q:w=1.4:g=7,equalizer=f=1700:t=q:w=2:g=-4,${grit},aecho=0.9:0.5:9|17:0.35|0.2,apad=pad_dur=0.05[v]`,
        squelch('s1', 0.06, 0.18),
        squelch('s2', 0.1, 0.2),
        `[s1][v][s2]concat=n=3:v=0:a=1[out]`,
      ].join(';');
    case 'intercom':
      // Vehicle crews: a harsh intercom over the idle of the engine.
      return [
        `${body},highpass=f=380,lowpass=f=3000,equalizer=f=1300:t=q:w=1:g=6,${grit},apad=pad_dur=0.2[v]`,
        `anoisesrc=d=${bed}:c=brown:a=0.5:r=44100,lowpass=f=140,tremolo=f=23:d=0.7,volume=-11dB,${FMT}[eng]`,
        `[v][eng]amix=inputs=2:duration=first:normalize=0[out]`,
      ].join(';');
    case 'whisper':
      // Marksmen keep their voice down: close to the microphone, almost no grit.
      return [
        `${body},highpass=f=180,lowpass=f=5200,equalizer=f=3200:t=q:w=1.5:g=3,acompressor=threshold=-26dB:ratio=4:attack=5:release=120:makeup=4,apad=pad_dur=0.05[v]`,
        squelch('s2', 0.07, 0.12),
        `[v][s2]concat=n=2:v=0:a=1[out]`,
      ].join(';');
    default:
      // Helmet vox: band-limited, driven hard, with squelch on both ends and static underneath.
      return [
        `${body},highpass=f=330,lowpass=f=3500,equalizer=f=1900:t=q:w=1.2:g=6,${grit},apad=pad_dur=0.04[v]`,
        squelch('s1', 0.05, 0.2),
        squelch('s2', 0.11, 0.24),
        `[s1][v][s2]concat=n=3:v=0:a=1[line]`,
        `anoisesrc=d=${bed}:c=white:a=0.01:r=44100,highpass=f=900,lowpass=f=3800,${FMT}[hiss]`,
        `[line][hiss]amix=inputs=2:duration=first:normalize=0[out]`,
      ].join(';');
  }
}

async function probe(file: string, entry: string): Promise<number> {
  return Number((await run('ffprobe', ['-v', 'error', '-show_entries', entry, '-of', 'csv=p=0', file])).toString().trim());
}

let tmpId = 0;

/** Runs the effect chain, then sets the peak to -1.5 dB so every line sits at the same level. */
async function produce(t: Take, raw: string, out: string): Promise<void> {
  const a = CAST[t.speaker];
  const seconds = await probe(raw, 'format=duration');
  const wav = join(CACHE, `tmp-${process.pid}-${tmpId++}.wav`);
  await run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-filter_complex', graph(a, moodOf(t.text), seconds), '-map', '[out]', '-ar', '44100', '-ac', '1', wav]);
  const stats = (await run('ffmpeg', ['-v', 'info', '-i', wav, '-af', 'volumedetect', '-f', 'null', '-'], undefined, true)).toString();
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(stats)?.[1] ?? 0);
  mkdirSync(dirname(out), { recursive: true });
  await run('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-af', `volume=${(-1.5 - peak).toFixed(2)}dB`, '-c:a', 'libmp3lame', '-b:a', '40k', '-ar', '32000', '-ac', '1', '-map_metadata', '-1', out]);
  rmSync(wav, { force: true });
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Signature of everything that shapes a finished file, so a changed chain re-processes it. */
function signature(t: Take): string {
  return createHash('sha1').update(JSON.stringify([CAST[t.speaker], MOOD, t.text, graph(CAST[t.speaker], moodOf(t.text), 1), engineFor(t)])).digest('hex').slice(0, 12);
}

/** A page for listening to the whole pack: open docs/voice-preview.html in a browser. */
function previewPage(takes: Take[]): string {
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const groups = new Map<string, Take[]>();
  for (const t of takes) groups.set(`${t.lang} / ${t.speaker}`, [...(groups.get(`${t.lang} / ${t.speaker}`) ?? []), t]);
  const sections = [...groups].map(([name, list]) => {
    const rows = list.map((t) => `<tr><td><button data-src="../public/${voiceFile(t.lang, t.speaker, t.key, t.variant)}">&#9654;</button></td><td>${esc(t.text)}</td><td class="k">${esc(t.key)}.${t.variant}</td></tr>`).join('\n');
    return `<details${name === 'ru / commander' ? ' open' : ''}><summary>${esc(name)} <span class="k">${list.length}</span></summary><table>${rows}</table></details>`;
  }).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>VoidCrusade voice pack</title>
<style>
body{background:#14161a;color:#d8d4c8;font:15px/1.4 Georgia,serif;max-width:860px;margin:0 auto;padding:16px}
h1{font-size:22px}summary{cursor:pointer;font-size:17px;padding:8px 0;color:#e0b060}
table{border-collapse:collapse;width:100%}td{padding:3px 8px;border-bottom:1px solid #262a30}
.k{color:#777;font:12px monospace}button{background:#2a2f38;color:#e0b060;border:1px solid #444;border-radius:4px;width:34px;height:28px;cursor:pointer}
button.on{background:#e0b060;color:#14161a}
</style></head><body>
<h1>VoidCrusade voice pack</h1>
<p>${takes.length} lines. Press a button to listen; the key on the right is the dictionary entry.</p>
${sections}
<script>
const player = new Audio(); let last = null;
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-src]'); if (!b) return;
  if (last) last.classList.remove('on');
  last = b; b.classList.add('on'); player.src = b.dataset.src; player.play();
});
player.addEventListener('ended', () => last && last.classList.remove('on'));
</script></body></html>
`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const check = args.includes('--check');
  const only = args.find((a) => a.startsWith('--only='))?.slice(7);
  const takes = collect();
  const manifest: VoiceManifest = { en: {}, ru: {} };
  for (const t of takes) (manifest[t.lang][voiceId(t.speaker, t.key)] ??= [])[t.variant] = voiceHash(t.text);

  const stampFile = join('scripts', 'voice.lock.json');
  const stamps: Record<string, string> = existsSync(stampFile) ? JSON.parse(readFileSync(stampFile, 'utf8')) : {};
  const wanted = new Set(takes.map((t) => join(OUT, voiceFile(t.lang, t.speaker, t.key, t.variant))));

  if (check) {
    const missing = takes.filter((t) => !existsSync(join(OUT, voiceFile(t.lang, t.speaker, t.key, t.variant))) || stamps[voiceFile(t.lang, t.speaker, t.key, t.variant)] !== signature(t));
    console.log(`Voice pack: ${takes.length} lines, ${missing.length} missing or out of date`);
    for (const t of missing.slice(0, 20)) console.log(`  - ${voiceFile(t.lang, t.speaker, t.key, t.variant)}: "${t.text}"`);
    process.exit(missing.length ? 1 : 0);
  }

  let made = 0;
  let failed = 0;
  const todo = takes.filter((t) => !only || t.speaker === only);
  const queue = todo.filter((t) => force || !existsSync(join(OUT, voiceFile(t.lang, t.speaker, t.key, t.variant))) || stamps[voiceFile(t.lang, t.speaker, t.key, t.variant)] !== signature(t));
  const total = queue.length;
  const worker = async (): Promise<void> => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      const rel = voiceFile(t.lang, t.speaker, t.key, t.variant);
      try {
        await produce(t, await record(t), join(OUT, rel));
        stamps[rel] = signature(t);
        made++;
        if (made % 20 === 0) {
          console.log(`  ${made}/${total} ${rel}`);
          writeFileSync(stampFile, JSON.stringify(stamps, null, 0));
        }
      } catch (e) {
        failed++;
        console.error(`FAILED ${rel}: ${(e as Error).message.split('\n')[0]}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Number(process.env.VOICE_JOBS ?? 6) }, worker));

  // Drop recordings of lines that no longer exist.
  let removed = 0;
  for (const f of walk(join(OUT, 'voice'))) {
    if (f.endsWith('.mp3') && !wanted.has(f)) {
      rmSync(f);
      removed++;
    }
  }
  for (const k of Object.keys(stamps)) if (!wanted.has(join(OUT, k))) delete stamps[k];
  // The manifest only lists what is really on disk and current.
  for (const t of takes) {
    const rel = voiceFile(t.lang, t.speaker, t.key, t.variant);
    if (!existsSync(join(OUT, rel)) || stamps[rel] !== signature(t)) manifest[t.lang][voiceId(t.speaker, t.key)][t.variant] = '';
  }
  mkdirSync(join(OUT, 'voice'), { recursive: true });
  writeFileSync(stampFile, JSON.stringify(stamps, null, 0));
  writeFileSync(join(OUT, 'voice', 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(join('docs', 'voice-preview.html'), previewPage(takes));
  const bytes = walk(join(OUT, 'voice')).filter((f) => f.endsWith('.mp3')).reduce((s, f) => s + statSync(f).size, 0);
  console.log(`Voice pack: ${takes.length} lines, ${made} recorded, ${removed} removed, ${failed} failed, ${(bytes / 1048576).toFixed(2)} MB`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
