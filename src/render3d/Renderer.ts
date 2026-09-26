/**
 * Contract for a battlefield renderer. The simulation never calls into a renderer; a renderer
 * reads simulation state (units, buildings, map, camera) once per frame and draws it.
 *
 * Implementations:
 * - Battle3D (src/render3d): Three.js battlefield under the Phaser canvas.
 * - Classic 2D: the Phaser sprites owned by Unit / BuildingView / TerrainRenderer. When the 3D
 *   renderer is active those sprites stay alive for gameplay (frames, visibility, hit tests)
 *   but are hidden from the battle camera through hide2D().
 */
export interface BattleRenderer {
  /** Ground height (3D px) at a logical point; 0 for the flat 2D view. */
  heightAt(x: number, y: number): number;
  dispose(): void;
}
