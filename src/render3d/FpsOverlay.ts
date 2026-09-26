import { Settings } from '../systems/Settings';

/** Small DOM FPS counter (Settings → Show FPS), drawn above both canvases. */
export class FpsOverlay {
  private el: HTMLDivElement;
  private t = 0;

  constructor() {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', right: '8px', bottom: '8px', padding: '2px 6px', font: '12px monospace', color: '#c8ffb0',
      background: 'rgba(0,0,0,0.55)', zIndex: '10', pointerEvents: 'none', borderRadius: '3px', display: 'none',
    });
    document.body.appendChild(this.el);
  }

  update(fps: number, label: string): void {
    const on = !!Settings.get().showFps;
    this.el.style.display = on ? 'block' : 'none';
    if (!on) return;
    const now = performance.now();
    if (now - this.t < 250) return;
    this.t = now;
    this.el.textContent = `${Math.round(fps)} FPS · ${label}`;
  }

  destroy(): void {
    this.el.remove();
  }
}
