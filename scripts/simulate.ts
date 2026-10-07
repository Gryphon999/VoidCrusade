/**
 * Headless AI-vs-AI balance simulation.
 *
 *   npx tsx scripts/simulate.ts [--matches=9] [--seed=1] [--max=900] [--diff=hard] [--pdiff=hard] [--parallel=3] [--json=out.json]
 *
 * Starts a Vite dev server, opens headless Chromium pages and plays Iron Void AI (player side)
 * against Null Horde AI (enemy side) on every map, cycling the enemy personality. Math.random is
 * replaced by a seeded generator and the game loop is stepped manually at 20 Hz, so a run with the
 * same seed replays the same matches. Prints win rates, average duration, unit usage and
 * cost-efficiency (damage dealt per 100 resources spent on that unit type).
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, chromium } from 'playwright-core';
import { startServer, stopServer } from './devserver';

const args = process.argv.slice(2);
const opt = (name: string, def: string): string => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def;
const MATCHES = Number(opt('matches', '9'));
const SEED = Number(opt('seed', '1'));
const MAX = Number(opt('max', '900'));
const DIFF = opt('diff', 'hard');
const PDIFF = opt('pdiff', DIFF);
const PARALLEL = Number(opt('parallel', '3'));
const JSON_OUT = opt('json', '');
/** Battle modifiers for every match, e.g. --mods=night,scarcity (see src/battle/BattleModifiers). */
const MODS = opt('mods', '').split(',').filter(Boolean);
const PORT = 5198;
const PERSONALITIES = ['balanced', 'rusher', 'turtler'];
/** Number of battle maps (src/maps/index.ts). */
const MAPS = 5;

function findChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
  const exe = dir && join(root, dir, 'chrome-linux', 'chrome');
  return exe && existsSync(exe) ? exe : undefined;
}

interface UnitStat { trained: number; spent: number; damage: number; kills: number }
interface MatchResult {
  seed: number;
  map: number;
  personality: string;
  playerPersonality: string;
  winner: 'player' | 'enemy' | 'draw';
  time: number;
  units: Record<string, UnitStat>;
  points: { player: number; enemy: number };
  /** State when the match stopped: army supply, structures standing and headquarters health (0-1). */
  end: Record<'player' | 'enemy', { supply: number; buildings: number; hq: number }>;
}

async function playMatch(browser: Browser, url: string, m: { seed: number; map: number; personality: string; playerPersonality: string }): Promise<MatchResult> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error(`[match ${m.seed}] pageerror:`, e.message));
  // tsx (esbuild keepNames) wraps functions in __name(); give the page a no-op version.
  await page.addInitScript('globalThis.__name = (f) => f;');
  await page.addInitScript((seed: number) => {
    // mulberry32: deterministic Math.random for reproducible matches.
    let a = seed >>> 0;
    Math.random = (): number => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try {
      localStorage.setItem('voidcrusade.settings.v1', JSON.stringify({ language: 'en', tutorialPrompted: true, hints: false, voiceEnabled: false, graphics: 'low' }));
    } catch {
      /* ignore */
    }
  }, m.seed);
  await page.goto(url);
  await page.waitForFunction(() => !!(window as never as { game?: { scene: { getScene(k: string): unknown } } }).game?.scene.getScene('MenuScene'), null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  const data = { mode: 'skirmish', mapIndex: m.map, difficulty: DIFF, personality: m.personality, modifiers: MODS };
  await page.evaluate((d) => {
    const g = (window as never as { game: { scene: { getScenes(a: boolean): { scene: { key: string; stop(): void } }[]; start(k: string, d: object): void } } }).game;
    g.scene.getScenes(true).forEach((s) => s.scene.key !== 'SubtitleScene' && s.scene.stop());
    g.scene.start('BattleScene', d);
  }, data);
  await page.waitForFunction(() => {
    const b = (window as never as { game: { scene: { getScene(k: string): { hud?: { scene: { isActive(): boolean } } } } } }).game.scene.getScene('BattleScene');
    return !!b?.hud?.scene.isActive();
  }, null, { timeout: 90000 });
  // Everything below runs inside the page; `any` keeps the harness short.
  const result = await page.evaluate(async ([pdiff, pp, max]) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any;
    const { AIController } = await import('/src/ai/AIController.ts' as string);
    const b = w.game.scene.getScene('BattleScene');
    w.game.loop.sleep();
    const ai2 = new AIController(b, pdiff, pp, 'player');
    b.aiOwners = ['player', 'enemy'];
    const units: Record<string, { trained: number; spent: number; damage: number; kills: number }> = {};
    const stat = (id: string): { trained: number; spent: number; damage: number; kills: number } => (units[id] ??= { trained: 0, spent: 0, damage: 0, kills: 0 });
    b.events.on('squad-spawned', (s: any) => {
      const st = stat(s.def.id);
      st.trained++;
      st.spent += s.def.cost.scrip + s.def.cost.flux;
    });
    const orig = b.combat.applyDamage.bind(b.combat);
    b.combat.applyDamage = (victim: any, dmg: number, from: any, type: any): void => {
      const before = victim.hp;
      const wasAlive = victim.alive;
      orig(victim, dmg, from, type);
      if (!from?.def) return;
      const st = stat(from.def.id);
      st.damage += Math.max(0, before - Math.max(0, victim.hp));
      if (wasAlive && !victim.alive) st.kills++;
    };
    const pts = { player: 0, enemy: 0 };
    let samples = 0;
    // The game loop sleeps; step the scene clock and tweens ourselves so delayed calls (drops) fire.
    let clock = b.time.now;
    while (!b.ended && b.elapsed < max) {
      for (let i = 0; i < 20 && !b.ended; i++) {
        clock += 50;
        b.time.preUpdate?.(clock, 50);
        b.time.update(clock, 50);
        b.update(clock, 50);
        b.tweens.update(clock, 50);
        ai2.update(0.05);
      }
      pts.player += b.capture.countOwned('player');
      pts.enemy += b.capture.countOwned('enemy');
      samples++;
    }
    const endOf = (o: string): { supply: number; buildings: number; hq: number } => {
      const hq = b.buildings.getHQ(o);
      return {
        supply: b.units.getSquads(o).reduce((n: number, s: any) => n + s.def.supply, 0),
        buildings: b.buildings.getOwned(o).length,
        hq: hq ? +(hq.hp / hq.maxHp).toFixed(2) : 0,
      };
    };
    return {
      end: { player: endOf('player'), enemy: endOf('enemy') },
      winner: b.result ? b.result.winner : 'draw',
      time: Math.round(b.elapsed),
      units,
      points: { player: +(pts.player / Math.max(1, samples)).toFixed(2), enemy: +(pts.enemy / Math.max(1, samples)).toFixed(2) },
    };
  }, [PDIFF, m.playerPersonality, MAX] as const);
  await page.close();
  return { ...m, ...(result as Omit<MatchResult, 'seed' | 'map' | 'personality' | 'playerPersonality'>) };
}

function report(results: MatchResult[]): void {
  const n = results.length;
  const wins = { player: 0, enemy: 0, draw: 0 };
  for (const r of results) wins[r.winner]++;
  const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
  console.log(`\n=== ${n} matches · Iron Void (${PDIFF}) vs Null Horde (${DIFF}) · seed ${SEED} ===`);
  console.log(`Iron Void wins ${wins.player} (${Math.round((wins.player / n) * 100)}%) · Null Horde wins ${wins.enemy} (${Math.round((wins.enemy / n) * 100)}%) · draws ${wins.draw}`);
  const decided = results.filter((r) => r.winner !== 'draw');
  console.log(`Average duration ${Math.round(avg(results.map((r) => r.time)))} s (decided games ${Math.round(avg(decided.map((r) => r.time)))} s)`);
  console.log(`Average points held: Iron Void ${avg(results.map((r) => r.points.player)).toFixed(2)} · Null Horde ${avg(results.map((r) => r.points.enemy)).toFixed(2)}`);
  for (const p of PERSONALITIES) {
    const rs = results.filter((r) => r.personality === p);
    if (rs.length) console.log(`  vs ${p.padEnd(8)}: Horde wins ${rs.filter((r) => r.winner === 'enemy').length}/${rs.length}`);
  }
  const total: Record<string, { trained: number; spent: number; damage: number; kills: number }> = {};
  for (const r of results) {
    for (const [id, s] of Object.entries(r.units)) {
      const t = (total[id] ??= { trained: 0, spent: 0, damage: 0, kills: 0 });
      t.trained += s.trained;
      t.spent += s.spent;
      t.damage += s.damage;
      t.kills += s.kills;
    }
  }
  const rows = Object.entries(total).sort((a, b) => b[1].trained - a[1].trained);
  console.log('\nunit          trained   spent   damage   kills   dmg/100');
  for (const [id, s] of rows) {
    const eff = s.spent > 0 ? (s.damage / s.spent) * 100 : 0;
    console.log(`${id.padEnd(12)} ${String(s.trained).padStart(8)} ${String(Math.round(s.spent)).padStart(7)} ${String(Math.round(s.damage)).padStart(8)} ${String(s.kills).padStart(7)} ${eff.toFixed(0).padStart(9)}`);
  }
  const used = rows.filter(([, s]) => s.trained > 0 && s.spent > 0);
  if (used.length) {
    console.log(`\nMost used: ${used.slice(0, 3).map(([id]) => id).join(', ')} · least used: ${used.slice(-3).map(([id]) => id).join(', ')}`);
  }
}

async function main(): Promise<void> {
  const { server, url } = await startServer(PORT);
  try {
    const browser = await chromium.launch({ executablePath: findChromium(), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
    const plan = Array.from({ length: MATCHES }, (_, i) => ({
      seed: SEED * 1000 + i,
      map: i % MAPS,
      personality: PERSONALITIES[Math.floor(i / MAPS) % PERSONALITIES.length],
      // Full factorial over 45 matches: every map meets every pair of personalities.
      playerPersonality: PERSONALITIES[Math.floor(i / (MAPS * 3)) % PERSONALITIES.length],
    }));
    const results: MatchResult[] = [];
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < plan.length) {
        const m = plan[next++];
        const t0 = Date.now();
        let r: MatchResult;
        try {
          r = await playMatch(browser, url, m);
        } catch (e) {
          console.error(`match seed=${m.seed} failed:`, (e as Error).message.split('\n')[0]);
          continue;
        }
        results.push(r);
        console.log(`match seed=${r.seed} map=${r.map} horde=${r.personality} void=${r.playerPersonality}: ${r.winner} in ${r.time}s · void ${r.end.player.supply} supply, ${r.end.player.buildings} bld, hq ${r.end.player.hq} · horde ${r.end.enemy.supply} supply, ${r.end.enemy.buildings} bld, hq ${r.end.enemy.hq} · points ${r.points.player}/${r.points.enemy}`);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, PARALLEL) }, worker));
    results.sort((a, b) => a.seed - b.seed);
    report(results);
    if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
    await browser.close();
  } finally {
    stopServer(server);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
