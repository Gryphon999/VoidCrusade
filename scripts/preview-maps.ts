// Dev helper: prints each map as ASCII and checks connectivity. Run: npx tsx scripts/preview-maps.ts
import { MAP_BUILDERS } from '../src/maps/index';

for (const build of MAP_BUILDERS) {
  const m = build();
  const H = m.tiles.length;
  const W = m.tiles[0].length;
  const ch = ['.', '#', '=', '%'];
  const rows = m.tiles.map((r) => r.map((t) => ch[t]));
  for (const c of m.capturePoints) rows[Math.floor(c.y)][Math.floor(c.x)] = 'C';
  for (const b of [m.playerBase, m.enemyBase]) rows[b.ty][b.tx] = 'B';
  console.log(`== ${m.name}`);
  console.log(rows.map((r) => r.join('')).join('\n'));
  // BFS from player base.
  const seen = new Set<number>();
  const q = [m.playerBase.ty * W + m.playerBase.tx];
  seen.add(q[0]);
  while (q.length) {
    const i = q.pop() as number;
    const x = i % W;
    const y = Math.floor(i / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || m.tiles[ny][nx] === 1) continue;
      const k = ny * W + nx;
      if (!seen.has(k)) { seen.add(k); q.push(k); }
    }
  }
  const targets = [m.enemyBase, ...m.capturePoints.map((c) => ({ tx: Math.floor(c.x), ty: Math.floor(c.y) }))];
  const bad = targets.filter((t) => !seen.has(t.ty * W + t.tx));
  console.log(bad.length ? `UNREACHABLE: ${JSON.stringify(bad)}` : 'all reachable');
}
