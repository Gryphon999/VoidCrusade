/**
 * Captures reference screenshots of the game into docs/screens/<set>/.
 *
 *   npx tsx scripts/screenshots.ts [set] [--langs=en,ru] [--sizes=1280x720,1920x1080]
 *
 * Starts a Vite dev server (the dev build exposes window.game), drives the game with
 * Playwright and saves PNGs. Needs a Chromium binary: set CHROMIUM_PATH, or have
 * Playwright's browsers installed (PLAYWRIGHT_BROWSERS_PATH).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, Page } from 'playwright-core';

const args = process.argv.slice(2);
const set = args.find((a) => !a.startsWith('--')) ?? 'current';
const opt = (name: string, def: string): string[] =>
  (args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def).split(',').filter(Boolean);
const langs = opt('langs', 'en');
const sizes = opt('sizes', '1280x720').map((s) => s.split('x').map(Number) as [number, number]);
const outDir = join('docs', 'screens', set);
const PORT = 5199;

function findChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
  const exe = dir && join(root, dir, 'chrome-linux', 'chrome');
  return exe && existsSync(exe) ? exe : undefined;
}

async function waitForServer(url: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server did not start');
}

type Game = { scene: { getScene(k: string): unknown; start(k: string, d?: object): void; getScenes(a: boolean): { scene: { key: string; stop(): void } }[] } };
declare global {
  interface Window {
    game: Game;
  }
}

async function startScene(page: Page, key: string, data: object): Promise<void> {
  await page.evaluate(([k, d]) => {
    const g = window.game;
    g.scene.getScenes(true).forEach((s) => s.scene.key !== k && s.scene.stop());
    g.scene.start(k as string, d as object);
  }, [key, data] as const);
}

/** Advances the battle simulation quickly (the render loop keeps running too). */
async function simulate(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => {
    const b = window.game.scene.getScene('BattleScene') as { update(t: number, d: number): void; tweens: { update(t: number, d: number): void } };
    for (let i = 0; i < s * 20; i++) {
      b.update(0, 50);
      b.tweens.update(0, 50);
    }
  }, seconds);
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log('saved', name);
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
  const url = `http://localhost:${PORT}/`;
  try {
    await waitForServer(url);
    const browser = await chromium.launch({ executablePath: findChromium(), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
    for (const lang of langs) {
      for (const [w, h] of sizes) {
        const suffix = `${lang}-${w}x${h}`;
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        page.on('pageerror', (e) => console.error('[pageerror]', e.message));
        await page.addInitScript((l) => {
          try {
            const k = 'voidcrusade.settings.v1';
            const s = JSON.parse(localStorage.getItem(k) ?? '{}');
            localStorage.setItem(k, JSON.stringify({ ...s, language: l }));
          } catch {
            /* ignore */
          }
        }, lang);
        await page.goto(url);
        await page.mouse.move(w / 2, h / 2);
        await page.waitForFunction(() => !!window.game?.scene.getScene('MenuScene'), null, { timeout: 60000 });
        await page.waitForTimeout(6000);
        await shoot(page, `menu-${suffix}`);
        await startScene(page, 'CampaignScene', { fresh: true });
        await page.waitForTimeout(1500);
        await shoot(page, `campaign-${suffix}`);
        await startScene(page, 'BattleScene', { mode: 'skirmish', mapIndex: 0, difficulty: 'normal' });
        await page.waitForTimeout(2500);
        await shoot(page, `battle-start-${suffix}`);
        // HUD: the stronghold selected shows its portrait and the build grid.
        await page.evaluate(() => {
          type S = { buildings: { getHQ(o: string): unknown }; selection: { selectBuilding(b: unknown): void } };
          const b = window.game.scene.getScene('BattleScene') as S;
          b.selection.selectBuilding(b.buildings.getHQ('player'));
        });
        await shoot(page, `hud-${suffix}`);
        // Big fight: two armies clash in view.
        await page.evaluate(() => {
          type S = { units: { spawnSquad(id: string, o: string, x: number, y: number): { moveTo(x: number, y: number, a: boolean): void } }; cameraSystem: { centerOn(x: number, y: number): void };
            capture: { points: { x: number; y: number }[] }; selection: { selectSquads(s: unknown[]): void }; fog?: { enabled: boolean; recompute(): void } };
          const b = window.game.scene.getScene('BattleScene') as S;
          const p = b.capture.points[0];
          const mine: unknown[] = [];
          for (let i = 0; i < 4; i++) {
            const s = b.units.spawnSquad(i % 2 ? 'heavy' : 'rifleman', 'player', p.x - 380, p.y - 150 + i * 90);
            s.moveTo(p.x - 60, p.y - 120 + i * 70, true);
            mine.push(s);
          }
          for (let i = 0; i < 4; i++) {
            const s = b.units.spawnSquad(i === 3 ? 'behemoth' : 'crawler', 'enemy', p.x + 380, p.y - 150 + i * 90);
            s.moveTo(p.x + 60, p.y - 120 + i * 70, true);
          }
          if (b.fog) {
            b.fog.enabled = false;
            b.fog.recompute();
          }
          b.selection.selectSquads(mine.slice(0, 2));
          b.cameraSystem.centerOn(p.x, p.y);
        });
        await simulate(page, 5);
        await shoot(page, `battle-fight-${suffix}`);
        await page.close();
      }
    }
    await browser.close();
  } finally {
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
