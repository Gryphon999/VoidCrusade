/**
 * Content-update screenshots (JPEG) into docs/screens/content/:
 *
 *   npx tsx scripts/screenshots-content.ts [--langs=en,ru] [--quality=78]
 *
 * Tutorial step, Encyclopedia, research tree, vehicles and monsters, a bunker fight and a drop
 * landing, in each language. Staged through the dev build's window.game.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, Page } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name: string, def: string): string => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def;
const langs = opt('langs', 'en,ru').split(',');
const quality = Number(opt('quality', '78'));
const outDir = join('docs', 'screens', 'content');
const PORT = 5196;

function findChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
  const exe = dir && join(root, dir, 'chrome-linux', 'chrome');
  return exe && existsSync(exe) ? exe : undefined;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function battle(page: Page, data: object): Promise<void> {
  await page.evaluate((d) => {
    const g = (window as any).game;
    const b = g.scene.getScene('BattleScene');
    // Restart through the scene itself (like the game's own Restart); stopping scenes by hand in
    // the same tick as a start leaves every other restart half shut down.
    if (b?.sys.settings.status >= 2 && b.sys.settings.status <= 6) {
      if (b.scene.isPaused()) b.scene.resume();
      g.scene.getScenes(true).forEach((s: any) => s.scene.key === 'EncyclopediaScene' && s.scene.stop());
      b.scene.restart(d);
    } else {
      g.scene.getScenes(true).forEach((s: any) => s.scene.key !== 'SubtitleScene' && s.scene.stop());
      g.scene.start('BattleScene', d);
    }
  }, data);
  await page.waitForFunction(() => {
    const b = (window as any).game.scene.getScene('BattleScene');
    return !!b?.hud?.scene.isActive() && b.elapsed > 0.2;
  }, null, { timeout: 90000 });
  await page.waitForTimeout(800);
}

/** Steps the simulation (and its clock/tweens) without waiting for real time. */
async function sim(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => {
    const b = (window as any).game.scene.getScene('BattleScene');
    for (let i = 0; i < s * 20; i++) {
      b.update(0, 50);
      b.tweens.update(0, 50);
    }
  }, seconds);
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, `${name}.jpg`), type: 'jpeg', quality });
  console.log('saved', name);
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32', env: { ...process.env, VC_STATIC: '1' } });
  const url = `http://localhost:${PORT}/`;
  try {
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(url)).ok) break;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    const browser = await chromium.launch({ executablePath: findChromium(), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    for (const lang of langs) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('pageerror', (e) => console.error('[pageerror]', e.message));
      await page.addInitScript('globalThis.__name = (f) => f;');
      await page.addInitScript((l) => {
        localStorage.setItem('voidcrusade.settings.v1', JSON.stringify({ language: l, tutorialPrompted: true, hints: false, voiceEnabled: false, graphics: 'high' }));
      }, lang);
      await page.goto(url);
      await page.mouse.move(640, 360);
      await page.waitForFunction(() => !!(window as any).game?.scene.getScene('MenuScene'), null, { timeout: 90000 });
      await page.waitForTimeout(4000);

      // 1. Tutorial: the Flux Conduit step with the Bastion selected (highlight on the grid).
      await battle(page, { mode: 'tutorial', difficulty: 'easy' });
      await page.evaluate(() => {
        const b = (window as any).game.scene.getScene('BattleScene');
        for (let i = 0; i < 4; i++) b.tutorial.skip();
        b.selection.selectBuilding(b.buildings.getHQ('player'));
        const hq = b.buildings.getHQ('player');
        b.cameraSystem.centerOn(hq.x + 120, hq.y - 60);
      });
      await shoot(page, `tutorial-${lang}`);

      // 2. Encyclopedia on the tank.
      await page.evaluate(() => {
        const g = (window as any).game;
        g.scene.getScene('BattleScene').scene.pause();
        g.scene.getScene('HudScene').scene.launch('EncyclopediaScene', {});
        g.scene.bringToTop('EncyclopediaScene');
      });
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        const e = (window as any).game.scene.getScene('EncyclopediaScene');
        e.selected = 'tank';
        e.drawList();
        e.drawDetail();
      });
      await shoot(page, `encyclopedia-${lang}`);

      // 3. Research tree.
      await battle(page, { mode: 'skirmish', mapIndex: 1, difficulty: 'normal' });
      await page.evaluate(() => {
        const b = (window as any).game.scene.getScene('BattleScene');
        b.ai.enabled = false;
        const hq = b.buildings.getHQ('player');
        b.tech.setTier('player', 3);
        const lab = b.buildings.spawn('research', 'player', hq.tx + 6, hq.ty - 5, true);
        b.hud.openTree(lab);
      });
      await shoot(page, `techtree-${lang}`);
      await page.evaluate(() => (window as any).game.scene.getScene('HudScene').tree.close());

      // 4. Vehicles and monsters clash in the open.
      await battle(page, { mode: 'skirmish', mapIndex: 0, difficulty: 'normal' });
      await page.evaluate(() => {
        const b = (window as any).game.scene.getScene('BattleScene');
        b.ai.enabled = false;
        if (b.fog) {
          b.fog.enabled = false;
          b.fog.recompute();
        }
        const p = b.capture.points[0];
        ['tank', 'apc', 'buggy', 'artillery'].forEach((id, i) => b.units.spawnSquad(id, 'player', p.x - 420, p.y - 160 + i * 110).moveTo(p.x - 80, p.y - 130 + i * 85, true));
        ['titan', 'behemoth', 'skimmer', 'siegebeast'].forEach((id, i) => b.units.spawnSquad(id, 'enemy', p.x + 420, p.y - 160 + i * 110).moveTo(p.x + 80, p.y - 130 + i * 85, true));
        b.cameraSystem.centerOn(p.x, p.y);
      });
      await sim(page, 4);
      await shoot(page, `vehicles-${lang}`);

      // 5. Bunker fight: a garrisoned bunker and riflemen in cover hold off the swarm.
      await battle(page, { mode: 'skirmish', mapIndex: 2, difficulty: 'normal' });
      await page.evaluate(() => {
        const b = (window as any).game.scene.getScene('BattleScene');
        b.ai.enabled = false;
        if (b.fog) {
          b.fog.enabled = false;
          b.fog.recompute();
        }
        const p = b.capture.points[0];
        const tx = Math.floor(p.x / 64) - 3;
        const ty = Math.floor(p.y / 64);
        b.tech.setTier('player', 3);
        const bunker = b.buildings.spawn('bunker', 'player', tx, ty, true);
        for (let i = 0; i < 4; i++) b.buildings.spawn('wall', 'player', tx + 2, ty - 2 + i, true);
        const g = b.units.spawnSquad('rifleman', 'player', bunker.x, bunker.y + 90);
        g.enterBunker(bunker);
        for (let i = 0; i < 2; i++) b.units.spawnSquad(i ? 'breacher' : 'heavy', 'player', bunker.x - 60, bunker.y - 120 + i * 220).hold();
        ['crawler', 'leaper', 'spitter', 'crawler', 'behemoth'].forEach((id, i) => b.units.spawnSquad(id, 'enemy', p.x + 380, p.y - 200 + i * 100).moveTo(bunker.x, bunker.y, true));
        b.cameraSystem.centerOn(bunker.x + 160, bunker.y);
      });
      await sim(page, 6);
      await shoot(page, `bunker-${lang}`);

      // 6. Drop pods coming down next to a strategic point.
      await page.evaluate(() => {
        const b = (window as any).game.scene.getScene('BattleScene');
        const p = b.capture.points[1];
        b.cameraSystem.centerOn(p.x, p.y);
        for (let i = 0; i < 3; i++) {
          const x = p.x - 120 + i * 120;
          b.effects.targetMarker(x, p.y + 40, 60, 3, 0x60c0ff);
          b.drops.land('player', ['rifleman', 'breacher', 'heavy'][i], x, p.y + 40, false);
        }
      });
      await sim(page, 0.35);
      await shoot(page, `drops-${lang}`);
      await page.close();
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
