/** Phone gestures: tap, pan, long-press box, pinch and HUD touches. Runs in Node without Phaser. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Finger, TouchGestures } from '../src/systems/TouchGestures';

/** Gestures wired to a log of what they asked for. */
function rig(dragTaken = false): { g: TouchGestures<Finger>; log: string[]; pans: [number, number][]; scales: number[] } {
  const log: string[] = [];
  const pans: [number, number][] = [];
  const scales: number[] = [];
  const g = new TouchGestures<Finger>({
    tap: () => log.push('tap'),
    boxStart: () => log.push('boxStart'),
    boxEnd: () => log.push('boxEnd'),
    pan: (dx, dy) => pans.push([dx, dy]),
    pinch: (s) => scales.push(s),
    pinchStart: () => log.push('pinchStart'),
    dragTaken: () => dragTaken,
  });
  return { g, log, pans, scales };
}

const f = (id: number, x: number, y: number): Finger => ({ id, x, y });

test('a short touch that barely moves is a tap', () => {
  const { g, log, pans } = rig();
  g.down(f(1, 100, 100), 0, false);
  g.move(f(1, 104, 103));
  g.update(150);
  g.up(f(1, 104, 103));
  assert.deepEqual(log, ['tap']);
  assert.equal(pans.length, 0);
  assert.equal(g.state, 'idle');
});

test('dragging one finger pans the whole way, with no tap at the end', () => {
  const { g, log, pans } = rig();
  g.down(f(1, 100, 100), 0, false);
  g.move(f(1, 130, 100));
  g.move(f(1, 160, 110));
  g.up(f(1, 160, 110));
  assert.deepEqual(log, []);
  const total = pans.reduce((a, [dx, dy]) => [a[0] + dx, a[1] + dy], [0, 0]);
  assert.deepEqual(total, [60, 10]);
});

test('holding still starts a selection box, lifting ends it', () => {
  const { g, log, pans } = rig();
  g.down(f(1, 100, 100), 0, false);
  g.update(200);
  assert.equal(g.boxing, false);
  g.update(400);
  assert.equal(g.boxing, true);
  g.move(f(1, 300, 250));
  g.up(f(1, 300, 250));
  assert.deepEqual(log, ['boxStart', 'boxEnd']);
  assert.equal(pans.length, 0, 'drawing the box does not move the camera');
});

test('while placing a wall line, a drag draws instead of panning', () => {
  const { g, log, pans } = rig(true);
  g.down(f(1, 100, 100), 0, false);
  g.move(f(1, 200, 100));
  g.up(f(1, 200, 100));
  assert.deepEqual(log, ['boxStart', 'boxEnd']);
  assert.equal(pans.length, 0);
});

test('two fingers pinch: spreading them doubles the zoom; the last finger up does nothing', () => {
  const { g, log, scales, pans } = rig();
  g.down(f(1, 100, 100), 0, false);
  g.down(f(2, 200, 100), 10, false);
  g.move(f(2, 300, 100));
  assert.equal(scales.at(-1), 2);
  g.up(f(2, 300, 100));
  g.move(f(1, 160, 140));
  g.up(f(1, 160, 140));
  assert.deepEqual(log, ['pinchStart'], 'no tap and no box after a pinch');
  assert.equal(pans.length, 0, 'the finger left behind does not pan');
  assert.equal(g.state, 'idle');
});

test('a touch that starts on the HUD is left to the HUD', () => {
  const { g, log } = rig();
  g.down(f(1, 100, 700), 0, true);
  g.update(1000);
  g.up(f(1, 100, 700));
  assert.deepEqual(log, []);
  assert.equal(g.state, 'idle');
});
