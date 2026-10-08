# Voice-over notes

VoidCrusade ships a **recorded voice pack**: one audio file per line, per speaker, per language
(`public/voice/<lang>/<speaker>/<key>.<n>.mp3`). The browser's speech synthesis is only the
fallback for a line that has no current recording.

To listen to the whole pack, open [voice-preview.html](voice-preview.html) in a browser.

## The cast

Nine speakers, each with their own voice, delivery and effect chain (`CAST` in `scripts/voice.ts`):

| Speaker | Who | Sound |
|---|---|---|
| commander | the hero, tutorial narration, victory and defeat | deep, slow, the echo of a vaulted hall |
| announcer | fleet command: alerts and reports | clean narrow channel, quiet carrier, closing squelch |
| rifleman | Void Riflemen | helmet vox: band-limited, driven, static and squelch |
| heavy | Iron Guard | the same vox, lower and heavier |
| ranger | Void Rangers | the same vox, light and quick |
| breacher | Breacher Squad | respirator: muffled and boxy |
| marksman | Void Marksmen | kept low, close to the microphone |
| engineer | Field Engineers | helmet vox, brighter |
| crew | buggy, APC, tank, mortar | harsh intercom over an idling engine |

The delivery follows the text: a line with `!` is recorded faster, higher and louder and is driven
harder; a one-word report stays calm.

## How it works

- `src/systems/VoiceCast.ts` says who can speak which line (`speakersFor`), where its file lives
  and how its text is hashed. The game and the generator share it.
- `npm run voice` (`scripts/voice.ts`) records every line for every speaker that can say it, runs
  the take through the speaker's ffmpeg chain, sets every file to the same peak level and writes
  `public/voice/manifest.json`. `scripts/voice.lock.json` remembers what each file was made from,
  so only changed lines are recorded again. Raw takes are cached in `.voice-cache/` (not in git).
- `src/systems/VoiceSystem.ts` plays the file when the manifest holds the hash of the exact text
  being spoken. A line whose text was edited after recording is therefore never played with the
  old words: it falls back to speech synthesis until `npm run voice` runs again.
- A speaker never repeats the variant they used last time for the same line.
- Lines have priorities (alerts > events > acknowledgements) and per-category cooldowns. Only one
  line plays at a time; a higher-priority line cancels a lower one; the same alert never repeats
  within 15 seconds. Voice stops when the game is paused, the window loses focus or the language
  changes. Music is ducked while a line plays.
- Lines are fetched lazily. The announcer's alerts and each squad type's first acknowledgements
  are fetched when the battle starts or the squad appears.
- **Subtitles** are always available (Settings → Subtitles).

## Recording

```
npm run voice                       # record what is missing or changed
npm run voice -- --only=commander   # one speaker
npm run voice -- --force            # process everything again (raw takes stay cached)
npm run voice -- --check            # verify the pack, write nothing
```

Needs `ffmpeg` on PATH and a speech engine:

- **`VOICE_ENGINE=edge`** (default): the `edge-tts` command line tool (`pip install edge-tts`).
  If it is installed elsewhere, point `VOICE_TTS_CMD` at it, for example
  `wsl -e /home/me/.local/bin/edge-tts`.
- **`VOICE_ENGINE=elevenlabs`**: set `ELEVENLABS_API_KEY` and fill `ELEVEN_VOICES` in
  `scripts/voice.ts` with one voice id per speaker.

`npm test` fails when a line has no current recording.

## Limits

- The takes are neural text-to-speech, shaped by effects. They are not human actors: the emotion
  range is narrower than in a studio recording.
- Russian is read by multilingual voices, because the service does not serve its Russian-only
  voices to this client. Some of them may carry a slight accent.
- The `edge` engine uses the speech service behind a browser's read-aloud feature through an
  unofficial client. Check its terms before a commercial release, or record the pack again with
  a licensed engine.
