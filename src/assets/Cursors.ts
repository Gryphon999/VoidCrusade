/** Custom CSS cursors drawn on an offscreen canvas (no image files). */

function draw(size: number, paint: (c: CanvasRenderingContext2D) => void): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  paint(ctx);
  return canvas.toDataURL('image/png');
}

let cache: Record<'attack' | 'move', string> | null = null;

export function getCursors(): Record<'attack' | 'move', string> {
  if (cache) return cache;
  const attack = draw(32, (c) => {
    c.strokeStyle = '#000';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(16, 16, 10, 0, Math.PI * 2);
    c.moveTo(16, 1); c.lineTo(16, 10); c.moveTo(16, 22); c.lineTo(16, 31);
    c.moveTo(1, 16); c.lineTo(10, 16); c.moveTo(22, 16); c.lineTo(31, 16);
    c.stroke();
    c.strokeStyle = '#ff3030';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#ff3030';
    c.fillRect(15, 15, 2, 2);
  });
  const move = draw(32, (c) => {
    c.beginPath();
    c.moveTo(2, 2); c.lineTo(2, 24); c.lineTo(8, 18); c.lineTo(13, 28); c.lineTo(17, 26); c.lineTo(12, 16); c.lineTo(20, 16);
    c.closePath();
    c.fillStyle = '#40ff60';
    c.fill();
    c.strokeStyle = '#002000';
    c.lineWidth = 2;
    c.stroke();
  });
  cache = {
    attack: `url(${attack}) 16 16, crosshair`,
    move: `url(${move}) 2 2, pointer`,
  };
  return cache;
}
