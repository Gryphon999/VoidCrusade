/**
 * Close-up screenshots of unit and building models, and a frame-rate measurement, on the real GPU.
 *
 *   npx tsx scripts/screenshots-models.ts [--out=docs/screens/models] [--fps] [--only=units|buildings|maps] [--renderer=2d]
 *
 * Unlike the other screenshot tools this one does not force the software rasteriser, so it needs a
 * machine with a graphics card; set CHROMIUM_PATH to an installed Chrome or Edge.
 * With --fps it also plays the heavy benchmark scene on every quality tier and prints the numbers.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, Page } from 'playwright-core';
import { startServer, stopServer } from './devserver';

const args = process.argv.slice(2);
const opt = (name: string, def: string): string => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def;
const OUT = opt('out', join('docs', 'screens', 'models'));
const ONLY = opt('only', '');
const FPS = args.includes('--fps');
/** --renderer=2d shows the classic sprite view instead of the 3D battlefield. */
const RENDERER = opt('renderer', 'auto');
const PORT = 5196;

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    game: any;
  }
}

async function open(page: Page, url: string, graphics: string): Promise<void> {
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text().slice(0, 300)));
  await page.addInitScript(`globalThis.__name = (f) => f; globalThis.__debugShots = ${process.env.DEBUG_SHOTS ? 'true' : 'false'};`);
  await page.addInitScript(([g, r]) => {
    localStorage.setItem('voidcrusade.settings.v1', JSON.stringify({ language: 'en', graphics: g, tutorialPrompted: true, hints: false, cinematics: false, adaptiveQuality: false, voiceEnabled: false, showFps: false, renderer: r }));
  }, [graphics, RENDERER] as const);
  await page.goto(url);
  // Keep the pointer off the screen edge, or the camera scrolls away.
  await page.mouse.move(640, 300);
  await page.waitForFunction(() => !!window.game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
}

async function battle(page: Page, mapIndex: number): Promise<void> {
  await page.evaluate((m) => {
    const g = window.game;
    const current = g.scene.getScene('BattleScene');
    (window as any).__oldMap = current?.map ?? null;
    if (current?.sys.isActive()) {
      current.scene.start('BattleScene', { mode: 'skirmish', mapIndex: m, difficulty: 'normal' });
      return;
    }
    g.scene.getScenes(true).forEach((s: any) => s.scene.key !== 'SubtitleScene' && s.scene.stop());
    g.scene.start('BattleScene', { mode: 'skirmish', mapIndex: m, difficulty: 'normal' });
  }, mapIndex);
  await page.waitForFunction(() => {
    const b = window.game.scene.getScene('BattleScene');
    return b && b.map && b.map !== (window as any).__oldMap && b.hud && b.hud.scene.isActive() && b.elapsed > 0.2;
  }, null, { timeout: 180000 });
  await page.evaluate(() => {
    const b = window.game.scene.getScene('BattleScene');
    b.ai.enabled = false;
    if (b.fog) {
      b.fog.enabled = false;
      b.fog.recompute();
    }
    b.hud.scene.setVisible(false);
  });
}

async function shoot(page: Page, name: string, wait = 2500): Promise<void> {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 88 });
  console.log('saved', name);
}

const ROSTERS: Record<string, string[][]> = {
  ironvoid: [['commander', 'rifleman', 'ranger', 'breacher'], ['marksman', 'engineer', 'heavy'], ['buggy', 'apc', 'tank', 'artillery']],
  nullhorde: [['overlord', 'shaman', 'crawler', 'spitter'], ['leaper', 'burrower', 'skimmer', 'behemoth'], ['carrier', 'siegebeast', 'titan']],
};

async function units(page: Page): Promise<void> {
  for (const [faction, rows] of Object.entries(ROSTERS)) {
    for (const [r, row] of rows.entries()) {
      await battle(page, 1);
      await page.evaluate(([f, ids]) => {
        const b = window.game.scene.getScene('BattleScene');
        const p = b.capture.points[1] ?? b.capture.points[0];
        // Two figures of each type, pinned in place every frame: one facing the camera, one turned away.
        const pins: { u: any; x: number; y: number; a: number }[] = [];
        const big = (ids as string[]).some((id) => ['titan', 'behemoth', 'siegebeast', 'carrier', 'tank', 'artillery', 'apc', 'overlord'].includes(id));
        const zoom = big ? 2 : 3.4;
        const step = (1280 / zoom) * 0.86 / ids.length;
        (ids as string[]).forEach((id, i) => {
          const x = p.x + 160 + (i - (ids.length - 1) / 2) * step;
          // Squads of one get a second squad, so every type is seen from the front and from behind.
          const squads = [b.units.spawnSquad(id, f === 'ironvoid' ? 'player' : 'enemy', x, p.y + 150)];
          if (squads[0].units.length < 2) squads.push(b.units.spawnSquad(id, f === 'ironvoid' ? 'player' : 'enemy', x, p.y + 150));
          const all = squads.flatMap((s: any) => s.units);
          all.forEach((u: any, k: number) => pins.push(k < 2
            ? { u, x: x + (k ? step * 0.22 : -step * 0.22), y: p.y + 150 + (k ? -10 : 26), a: k ? -Math.PI * 0.72 : Math.PI * 0.36 }
            : { u, x: 300 + k * 30, y: 300, a: 0 }));
        });
        const pin = (): void => {
          for (const q of pins) {
            q.u.x = q.x;
            q.u.y = q.y;
            q.u.angle = q.a;
            q.u.turretAngle = q.a;
          }
        };
        b.events.on('preupdate', pin);
        b.events.on('update', pin);
        b.events.on('postupdate', pin);
        b.cameras.main.setZoom(zoom);
        b.cameraSystem.centerOn(p.x + 160, p.y + 120);
        if ((window as any).__debugShots) {
          const u = b.units.getSquads(f === 'ironvoid' ? 'player' : 'enemy').at(-1).units[0];
          console.error('debug', JSON.stringify({ p: [p.x, p.y], u: [u.x, u.y], visible: u.sprite.visible, alive: u.alive, zoom: b.cameras.main.zoom, scroll: [b.cameras.main.scrollX, b.cameras.main.scrollY] }));
        }
      }, [faction, row] as const);
      await shoot(page, `units-${faction}-${r + 1}`);
    }
  }
}

async function buildings(page: Page): Promise<void> {
  const lines: Record<string, string[][]> = {
    ironvoid: [['generator', 'depot', 'barracks', 'mechanis'], ['foundry', 'research', 'armoury', 'hospital'], ['turret', 'relay', 'listening', 'bunker', 'sensor', 'shield', 'missile', 'beacon']],
    nullhorde: [['spire', 'nest', 'brood', 'maw'], ['vat', 'evolution', 'pool', 'organ'], ['spine', 'sporenode', 'acidspire', 'portal', 'thornwall']],
  };
  for (const [faction, rows] of Object.entries(lines)) {
    for (const [r, row] of rows.entries()) {
      await battle(page, 1);
      const placed = await page.evaluate(([f, ids]) => {
        const b = window.game.scene.getScene('BattleScene');
        const p = b.capture.points[1] ?? b.capture.points[0];
        let tx = Math.floor(p.x / 64) - 9;
        const ty = Math.floor(p.y / 64) - 2;
        const done: string[] = [];
        for (const id of ids as string[]) {
          try {
            const bb = b.buildings.spawn(id, f === 'ironvoid' ? 'player' : 'enemy', tx, ty, true);
            tx += bb.def.size + 1;
            done.push(id);
          } catch {
            /* building id not in this build */
          }
        }
        b.cameras.main.setZoom(1.3);
        b.cameraSystem.centerOn((Math.floor(p.x / 64) - 9 + tx) * 32, p.y);
        return done;
      }, [faction, row] as const);
      console.log(faction, r + 1, placed.join(' '));
      await shoot(page, `buildings-${faction}-${r + 1}`, 5000);
    }
  }
}

/** Every battle map: the player's base, the centre, and how long the battle took to start. */
async function maps(page: Page): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    await battle(page, i);
    const info = await page.evaluate(() => {
      const b = window.game.scene.getScene('BattleScene');
      const hq = b.buildings.getHQ('player');
      b.cameras.main.setZoom(0.8);
      b.cameraSystem.centerOn(hq.x + 380, hq.y - 180);
      return { id: b.map.def.id, w: b.map.width, h: b.map.height, points: b.capture.points.length, income: b.capture.income };
    });
    console.log(`map ${i} ${info.id}: ${info.w}x${info.h}, ${info.points} points, ${info.income} scrip/s each, battle ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    await shoot(page, `map-${info.id}-base`);
    await page.evaluate(() => {
      const b = window.game.scene.getScene('BattleScene');
      b.cameras.main.setZoom(0.5);
      b.cameraSystem.centerOn(b.map.worldWidth / 2, b.map.worldHeight / 2);
    });
    await shoot(page, `map-${info.id}-centre`);
  }
}

/** The heavy scene of docs/performance.md: a base, 150 units fighting, everything on screen. */
async function benchmark(url: string, browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<void> {
  for (const tier of ['low', 'medium', 'high', 'ultra']) {
    // The last entry is a 1920x1200 laptop panel at 125 % scaling with the browser maximised.
    for (const [w, h, dpr] of [[1280, 720, 1], [1920, 1080, 1], [1536, 864, 1.25]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await open(page, url, tier);
      await battle(page, 0);
      const info = await page.evaluate(async () => {
        const b = window.game.scene.getScene('BattleScene');
        b.hud.scene.setVisible(true);
        const p = b.capture.points[0];
        const pl = ['rifleman', 'heavy', 'marksman', 'breacher', 'ranger', 'rifleman', 'rifleman', 'heavy', 'breacher', 'ranger', 'rifleman', 'engineer'];
        const en = ['crawler', 'spitter', 'leaper', 'behemoth', 'crawler', 'spitter', 'crawler', 'leaper', 'shaman', 'burrower', 'crawler', 'spitter'];
        for (let i = 0; i < pl.length; i++) b.units.spawnSquad(pl[i], 'player', p.x - 420 - (i % 2) * 70, p.y - 330 + i * 60).moveTo(p.x - 40, p.y - 200 + i * 36, true);
        for (let i = 0; i < en.length; i++) b.units.spawnSquad(en[i], 'enemy', p.x + 420 + (i % 2) * 70, p.y - 330 + i * 60).moveTo(p.x + 40, p.y - 200 + i * 36, true);
        for (let i = 0; i < 3; i++) b.units.spawnSquad('tank', 'player', p.x - 380, p.y + 300 + i * 90);
        const tx = Math.floor(p.x / 64);
        const ty = Math.floor(p.y / 64);
        const ids = ['generator', 'barracks', 'turret', 'depot', 'bunker', 'turret'];
        for (let i = 0; i < 24; i++) {
          try {
            b.buildings.spawn(ids[i % ids.length], 'player', tx - 12 + (i % 8) * 3, ty + 7 + Math.floor(i / 8) * 3, true);
          } catch {
            /* occupied tile */
          }
        }
        b.cameras.main.setZoom(0.7);
        b.cameraSystem.centerOn(p.x, p.y + 120);
        // Let the fight develop, then time real frames for 10 s.
        await new Promise((r) => setTimeout(r, 6000));
        const times: number[] = [];
        let last = performance.now();
        await new Promise<void>((done) => {
          const tick = (): void => {
            const now = performance.now();
            times.push(now - last);
            last = now;
            if (times.length < 2000 && now - t0 < 10000) requestAnimationFrame(tick);
            else done();
          };
          const t0 = performance.now();
          requestAnimationFrame(tick);
        });
        times.sort((a, c) => a - c);
        const avg = times.reduce((s, x) => s + x, 0) / times.length;
        const gl = document.createElement('canvas').getContext('webgl2');
        const ext = gl?.getExtension('WEBGL_debug_renderer_info');
        const stats = b.r3d ? { cpuMs: +b.r3d.stats.cpuMs.toFixed(1), calls: b.r3d.stats.calls, tris: b.r3d.stats.tris } : null;
        return {
          fps: +(1000 / avg).toFixed(1),
          low1: +(1000 / times[Math.floor(times.length * 0.99)]).toFixed(1),
          units: b.units.getSquads('player').concat(b.units.getSquads('enemy')).reduce((n: number, s: any) => n + s.units.length, 0),
          buildings: b.buildings.buildings.length,
          gpu: ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown',
          stats,
        };
      });
      console.log(`${tier.padEnd(6)} ${w}x${h} @${dpr}x: ${info.fps} fps (1% low ${info.low1}) · ${info.units} units, ${info.buildings} buildings · ${info.gpu}${info.stats ? ' · ' + JSON.stringify(info.stats) : ''}`);
      if (tier === 'high' && w === 1920) await shoot(page, 'benchmark-high', 500);
      await page.close();
    }
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const { server, url } = await startServer(PORT);
  try {
    // Headed and on the real GPU: a headless browser falls back to software rendering on Windows.
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: false, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--window-position=0,0', '--mute-audio'] });
    if (!FPS || ONLY) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      await open(page, url, 'high');
      if (ONLY === 'maps') await maps(page);
      else {
        if (ONLY !== 'buildings') await units(page);
        if (ONLY !== 'units') await buildings(page);
      }
      await page.close();
    }
    if (FPS) await benchmark(url, browser);
    await browser.close();
  } finally {
    stopServer(server);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
