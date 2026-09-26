/** Contextual gothic cursors drawn on an offscreen canvas (no image files). */

export type CursorKind = 'move' | 'attack' | 'capture' | 'build';

function draw(paint: (c: CanvasRenderingContext2D) => void): string {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  paint(ctx);
  return canvas.toDataURL('image/png');
}

function gold(c: CanvasRenderingContext2D): CanvasGradient {
  const g = c.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, '#fbe6a0');
  g.addColorStop(1, '#a07020');
  return g;
}

let cache: Record<CursorKind, string> | null = null;

export function getCursors(): Record<CursorKind, string> {
  if (cache) return cache;
  const move = draw((c) => {
    c.beginPath();
    c.moveTo(2, 2); c.lineTo(2, 25); c.lineTo(8, 19); c.lineTo(13, 29); c.lineTo(17, 27); c.lineTo(12, 17); c.lineTo(21, 17);
    c.closePath();
    c.fillStyle = gold(c);
    c.fill();
    c.strokeStyle = '#1a0e04';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#60ff70';
    c.fillRect(5, 8, 3, 3);
  });
  const attack = draw((c) => {
    c.strokeStyle = '#000';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(16, 16, 10, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#ff3a2a';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#ff3a2a';
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      c.save();
      c.translate(16, 16);
      c.rotate(a);
      c.beginPath();
      c.moveTo(0, -15); c.lineTo(3, -7); c.lineTo(-3, -7);
      c.closePath();
      c.strokeStyle = '#000';
      c.lineWidth = 1;
      c.stroke();
      c.fill();
      c.restore();
    }
    c.fillRect(15, 15, 2, 2);
  });
  const capture = draw((c) => {
    c.fillStyle = '#1a0e04';
    c.fillRect(5, 2, 4, 28);
    c.fillStyle = gold(c);
    c.fillRect(6, 2, 2, 28);
    c.beginPath();
    c.moveTo(8, 3); c.lineTo(28, 8); c.lineTo(8, 15);
    c.closePath();
    c.fillStyle = '#3a8dff';
    c.fill();
    c.strokeStyle = '#000';
    c.stroke();
  });
  const build = draw((c) => {
    c.save();
    c.translate(16, 16);
    c.rotate(-0.8);
    c.fillStyle = '#1a0e04';
    c.fillRect(-3, -4, 6, 20);
    c.fillStyle = gold(c);
    c.fillRect(-2, -3, 4, 18);
    c.fillRect(-10, -13, 20, 9);
    c.strokeStyle = '#000';
    c.strokeRect(-10, -13, 20, 9);
    c.restore();
  });
  cache = {
    move: `url(${move}) 2 2, pointer`,
    attack: `url(${attack}) 16 16, crosshair`,
    capture: `url(${capture}) 6 30, pointer`,
    build: `url(${build}) 6 6, pointer`,
  };
  return cache;
}
