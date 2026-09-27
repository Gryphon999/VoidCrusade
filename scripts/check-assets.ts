/**
 * Asset completeness check: npm run check:assets
 *
 * Boots the dev build in headless Chromium and verifies that every unit, building, ability and
 * research has its procedural art (atlas, portrait, turret, building icon, glyph), that every
 * projectile look and ability has a sound, and that every player-side unit and shouted ability
 * has a voice line. Exits non-zero on any gap.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { startServer, stopServer } from './devserver';

const PORT = 5197;

function findChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
  const exe = dir && join(root, dir, 'chrome-linux', 'chrome');
  return exe && existsSync(exe) ? exe : undefined;
}

async function main(): Promise<void> {
  const { server, url } = await startServer(PORT);
  let failures: string[] = [];
  let checked = 0;
  try {
    const browser = await chromium.launch({ executablePath: findChromium(), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript('globalThis.__name = (f) => f;');
    await page.goto(url);
    await page.waitForFunction(() => !!(window as never as { game?: { scene: { getScene(k: string): unknown } } }).game?.scene.getScene('MenuScene'), null, { timeout: 90000 });
    await page.waitForTimeout(2000);
    const out = await page.evaluate(async () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const imp = (p: string): Promise<any> => import(p);
      const { UNIT_DEFS } = await imp('/src/units/UnitDefs.ts');
      const { BUILDING_DEFS } = await imp('/src/buildings/BuildingDefs.ts');
      const { ABILITIES } = await imp('/src/units/Abilities.ts');
      const { RESEARCH_DEFS } = await imp('/src/systems/ResearchSystem.ts');
      const { atlasKey, portraitKey, turretKey } = await imp('/src/render/puppet/UnitAtlas.ts');
      const { buildingIconKey } = await imp('/src/render/buildings/BuildingArt.ts');
      const { researchGlyph } = await imp('/src/ui/GlyphIcons.ts');
      const { ABILITY_SOUNDS } = await imp('/src/systems/AudioSystem.ts');
      const { SHOUTS } = await imp('/src/systems/VoiceBridge.ts');
      const { en } = await imp('/src/i18n/en.ts');
      const { ru } = await imp('/src/i18n/ru.ts');
      const tex = (window as any).game.textures;
      const fail: string[] = [];
      let n = 0;
      const need = (ok: boolean, what: string): void => {
        n++;
        if (!ok) fail.push(what);
      };
      const voiced = (k: string): boolean => !!en[k] && !!ru[k];
      const SOUNDED = ['bullet', 'shell', 'melee', 'flame', 'sniper', 'psy', 'cannon', 'lob', 'acidlob', 'spit'];
      for (const d of Object.values(UNIT_DEFS) as any[]) {
        need(tex.exists(atlasKey(d.id)), `unit ${d.id}: sprite atlas`);
        need(tex.exists(portraitKey(d.id)), `unit ${d.id}: portrait icon`);
        if (d.turret) need(tex.exists(turretKey(d.id)), `unit ${d.id}: turret atlas`);
        need(SOUNDED.includes(d.projectile), `unit ${d.id}: weapon sound for '${d.projectile}'`);
        if (d.faction === 'ironvoid') need(voiced(`vo.select.${d.id}`), `unit ${d.id}: selection voice line`);
      }
      for (const d of Object.values(BUILDING_DEFS) as any[]) need(tex.exists(buildingIconKey(d.id)), `building ${d.id}: icon`);
      for (const d of Object.values(ABILITIES) as any[]) {
        need(tex.exists(d.icon), `ability ${d.id}: icon ${d.icon}`);
        need(typeof ABILITY_SOUNDS[d.id] === 'function', `ability ${d.id}: sound`);
        if (SHOUTS.includes(d.id)) need(voiced(`vo.ab.${d.id}`), `ability ${d.id}: voice line`);
      }
      for (const r of RESEARCH_DEFS as any[]) need(tex.exists(researchGlyph(r.id)), `research ${r.id}: icon`);
      // Voice: a line must be answered by its recorded file, in both languages.
      const { Voice } = await imp('/src/systems/VoiceSystem.ts');
      const { setLanguage } = await imp('/src/i18n/index.ts');
      const { Settings } = await imp('/src/systems/Settings.ts');
      Settings.set({ voiceEnabled: true });
      const played: string[] = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (this: HTMLMediaElement): Promise<void> {
        played.push(this.src);
        return play.call(this);
      };
      // Alerts share a cooldown and a line is not repeated for 15 s: wait, and use a line per language.
      for (const [lang, key] of [['en', 'vo.victory'], ['ru', 'vo.defeat']]) {
        setLanguage(lang);
        Voice.stop();
        await new Promise((r) => setTimeout(r, 6500));
        const before = played.length;
        const said = Voice.say(key, 'commander', 'alert');
        await new Promise((r) => setTimeout(r, 1500));
        const src = played[before] ?? '';
        const ok = await fetch(src || 'voice/missing').then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('audio')).catch(() => false);
        need(said && src.includes(`voice/${lang}/commander/${key}.`) && ok, `voice ${lang}: recorded line did not play (said ${said}, pack ${Voice.hasRecordings()}, file ${src || 'none'})`);
      }
      HTMLMediaElement.prototype.play = play;
      return { fail, n };
    });
    failures = out.fail;
    checked = out.n;
    await browser.close();
  } finally {
    stopServer(server);
  }
  console.log(`Checked ${checked} assets: ${failures.length} missing`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
