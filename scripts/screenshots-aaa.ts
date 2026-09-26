/**
 * Final graphics QA screenshots (JPEG) into docs/screens/aaa/final/:
 * menu and HUD in EN and RU at 1280×720, 1920×1080 and 2560×1440; the campaign map in both
 * languages; every battle map at the start; a big fight; each faction's unit roster and
 * building line-up.
 *
 *   npx tsx scripts/screenshots-aaa.ts [--quick]     (--quick: 1280×720 English only)
 *
 * Starts a Vite dev server (the dev build exposes window.game) and drives headless Chromium.
 * Software WebGL (SwiftShader) is slow: a full run takes several minutes.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, Page } from 'playwright-core';

const quick = process.argv.includes('--quick');
/** Skip the menu/HUD/campaign matrix (only maps, fight, rosters, line-ups). */
const rest = process.argv.includes('--rest');
const outDir = join('docs', 'screens', 'aaa', 'final');
const PORT = 5198;
const SIZES: [number, number][] = quick ? [[1280, 720]] : [[1280, 720], [1920, 1080], [2560, 1440]];
const LANGS = quick ? ['en'] : ['en', 'ru'];

function findChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
  const exe = dir && join(root, dir, 'chrome-linux', 'chrome');
  return exe && existsSync(exe) ? exe : undefined;
}

async function waitForServer(url: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server did not start');
}

// Loosely typed handles into the running game (dev build only).
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    game: any;
  }
}

async function open(page: Page, url: string, lang: string): Promise<void> {
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GL Driver') && console.log('[console]', m.text().slice(0, 400)));
  await page.addInitScript((l) => {
    localStorage.setItem('voidcrusade.settings.v1', JSON.stringify({ language: l, graphics: 'high', tutorialPrompted: true, hints: false, cinematics: false, adaptiveQuality: false }));
  }, lang);
  await page.goto(url);
  await page.mouse.move(640, 300);
  await page.waitForFunction(() => !!window.game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  if (process.env.DEBUG_AAA) console.log(await page.evaluate(() => [localStorage.getItem('voidcrusade.settings.v1'), !!document.createElement('canvas').getContext('webgl2'), document.querySelectorAll('canvas').length]));
}

async function start(page: Page, key: string, data: object): Promise<void> {
  await page.evaluate(([k, d]) => {
    const g = window.game;
    const current = g.scene.getScene(k);
    // Remember the old battle's map so the wait below sees the new battle, not the old one.
    (window as any).__oldMap = current?.map ?? null;
    // Stopping and starting the same scene in one tick leaves it stopped: restart it from itself.
    if (current?.sys.isActive()) {
      current.scene.start(k, d);
      return;
    }
    g.scene.getScenes(true).forEach((s: any) => s.scene.key !== 'SubtitleScene' && s.scene.stop());
    g.scene.start(k, d);
  }, [key, data] as const);
  await page.waitForTimeout(500);
  if (key === 'BattleScene') {
    await page.waitForFunction(() => {
      const b = window.game.scene.getScene('BattleScene');
      return b && b.map && b.map !== (window as any).__oldMap && b.hud && b.hud.scene.isActive() && b.elapsed > 0.2;
    }, null, { timeout: 180000 });
  }
}

async function shoot(page: Page, name: string, wait = 3500): Promise<void> {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(outDir, `${name}.jpg`), type: 'jpeg', quality: 80 });
  console.log('saved', name);
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  // Own process group, so the whole npx → vite tree is stopped at the end (a leftover server
  // without a file watcher would keep serving stale modules to the next run).
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32', detached: process.platform !== 'win32', env: { ...process.env, VC_STATIC: '1' } });
  const url = `http://localhost:${PORT}/`;
  try {
    await waitForServer(url);
    const browser = await chromium.launch({ executablePath: findChromium(), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
    for (const lang of rest ? [] : LANGS) {
      for (const [w, h] of SIZES) {
        const suffix = `${lang}-${w}`;
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        page.on('pageerror', (e) => console.error('[pageerror]', e.message));
        await open(page, url, lang);
        await shoot(page, `menu-${suffix}`, 5000);
        if (w === 1920) {
          await start(page, 'CampaignScene', { fresh: true });
          await shoot(page, `campaign-${lang}`, 5000);
        }
        // HUD over a skirmish with a squad selected (3D portrait, orders grid).
        await start(page, 'BattleScene', { mode: 'skirmish', mapIndex: 0, difficulty: 'normal' });
        await page.evaluate(() => {
          const b = window.game.scene.getScene('BattleScene');
          b.ai.enabled = false;
          const s = b.units.getSquads('player').find((q: any) => !q.def.isHero);
          b.selection.selectSquads([s]);
          b.cameraSystem.centerOn(s.center.x + 120, s.center.y - 60);
        });
        await shoot(page, `hud-${suffix}`);
        await page.close();
      }
    }
    // Everything else once, at 1920×1080 in English.
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));
    await open(page, url, 'en');
    for (const map of quick ? [0] : [0, 1, 2]) {
      await start(page, 'BattleScene', { mode: 'skirmish', mapIndex: map, difficulty: 'normal' });
      await page.evaluate(() => {
        const b = window.game.scene.getScene('BattleScene');
        b.ai.enabled = false;
        b.hud.scene.setVisible(false);
        const hq = b.buildings.getHQ('player');
        b.cameras.main.setZoom(0.8);
        b.cameraSystem.centerOn(hq.x + 380, hq.y - 180);
      });
      await shoot(page, `map${map}-start`);
    }
    // Big fight at the first Nexus point.
    await start(page, 'BattleScene', { mode: 'skirmish', mapIndex: 0, difficulty: 'normal' });
    await page.evaluate(() => {
      const b = window.game.scene.getScene('BattleScene');
      b.ai.enabled = false;
      if (b.fog) {
        b.fog.enabled = false;
        b.fog.recompute();
      }
      b.hud.scene.setVisible(false);
      const p = b.capture.points[0];
      const pl = ['rifleman', 'heavy', 'marksman', 'breacher', 'ranger', 'rifleman'];
      const en = ['crawler', 'spitter', 'leaper', 'behemoth', 'crawler', 'spitter'];
      for (let i = 0; i < 6; i++) b.units.spawnSquad(pl[i], 'player', p.x - 360, p.y - 220 + i * 80).moveTo(p.x - 40, p.y - 160 + i * 60, true);
      for (let i = 0; i < 6; i++) b.units.spawnSquad(en[i], 'enemy', p.x + 360, p.y - 220 + i * 80).moveTo(p.x + 40, p.y - 160 + i * 60, true);
      for (let i = 0; i < 2; i++) b.units.spawnSquad('tank', 'player', p.x - 300, p.y + 220 + i * 90);
      b.cameras.main.setZoom(1.25);
      b.cameraSystem.centerOn(p.x, p.y);
      for (let i = 0; i < 70; i++) {
        b.update(0, 50);
        b.tweens.update(0, 50);
      }
    });
    await shoot(page, 'fight', 2500);
    // Rosters and building line-ups on open ground.
    for (const faction of ['ironvoid', 'nullhorde']) {
      await start(page, 'BattleScene', { mode: 'skirmish', mapIndex: 1, difficulty: 'normal' });
      await page.evaluate((f) => {
        const b = window.game.scene.getScene('BattleScene');
        b.ai.enabled = false;
        if (b.fog) {
          b.fog.enabled = false;
          b.fog.recompute();
        }
        b.hud.scene.setVisible(false);
        const p = b.capture.points[1] ?? b.capture.points[0];
        const units = f === 'ironvoid'
          ? ['commander', 'rifleman', 'ranger', 'breacher', 'marksman', 'engineer', 'heavy', 'buggy', 'apc', 'tank', 'artillery']
          : ['overlord', 'shaman', 'crawler', 'spitter', 'leaper', 'burrower', 'skimmer', 'behemoth', 'carrier', 'siegebeast', 'titan'];
        units.forEach((id: string, i: number) => {
          try {
            const s = b.units.spawnSquad(id, f === 'ironvoid' ? 'player' : 'enemy', p.x - 520 + i * 95, p.y);
            s.units.forEach((u: any, k: number) => {
              u.x = p.x - 520 + i * 95 + (k % 2) * 16;
              u.y = p.y + Math.floor(k / 2) * 16;
              u.angle = Math.PI / 2;
            });
          } catch {
            /* unit id not in this build */
          }
        });
        b.cameras.main.setZoom(1.5);
        b.cameraSystem.centerOn(p.x - 50, p.y + 10);
      }, faction);
      await shoot(page, `roster-${faction}`);
    }
    for (const faction of ['ironvoid', 'nullhorde']) {
      await start(page, 'BattleScene', { mode: 'skirmish', mapIndex: 1, difficulty: 'normal' });
      await page.evaluate((f) => {
        const b = window.game.scene.getScene('BattleScene');
        b.ai.enabled = false;
        if (b.fog) {
          b.fog.enabled = false;
          b.fog.recompute();
        }
        b.hud.scene.setVisible(false);
        const iv = ['generator', 'depot', 'barracks', 'mechanis', 'foundry', 'turret', 'relay', 'research', 'gate', 'listening', 'bunker', 'armoury', 'hospital', 'sensor', 'shield', 'missile', 'beacon'];
        const hd = ['spire', 'nest', 'brood', 'maw', 'vat', 'spine', 'thornwall', 'sporenode', 'evolution', 'pool', 'organ', 'acidspire', 'portal'];
        const list = f === 'ironvoid' ? iv : hd;
        const errors: string[] = [];
        const p = b.capture.points[1] ?? b.capture.points[0];
        let tx = Math.floor(p.x / 64) - 11;
        let ty = Math.floor(p.y / 64) - 5;
        const x0 = tx;
        let row = 0;
        for (const id of list) {
          try {
            const bb = b.buildings.spawn(id, f === 'ironvoid' ? 'player' : 'enemy', tx, ty, true);
            tx += bb.def.size + 1;
            row = Math.max(row, bb.def.size);
            if (tx > x0 + 24) {
              tx = x0;
              ty += row + 1;
              row = 0;
            }
          } catch (e) {
            errors.push(`${id}: ${String(e)}`);
          }
        }
        b.cameras.main.setZoom(0.9);
        b.cameraSystem.centerOn(p.x, p.y);
        return { placed: b.buildings.buildings.length, errors: errors.slice(0, 3) };
      }, faction).then((r) => console.log('line-up', faction, JSON.stringify(r)));
      await shoot(page, `buildings-${faction}`, 20000);
    }
    await page.close();
    await browser.close();
  } finally {
    try {
      if (process.platform !== 'win32' && server.pid) process.kill(-server.pid);
      else server.kill();
    } catch {
      server.kill();
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
