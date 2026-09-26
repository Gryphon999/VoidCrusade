import type Phaser from 'phaser';

/**
 * Marks a 2D battlefield object as replaced by the 3D renderer: the battle camera stops drawing
 * it, while gameplay code keeps using it (positions, visibility, frames) as before.
 * A scene opts in by setting `render3d = true` before it creates its world objects.
 */
export function hide2D(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject): void {
  if (!(scene as Phaser.Scene & { render3d?: boolean }).render3d) return;
  scene.cameras.main.ignore(obj);
  (obj as HiddenIn3D).hiddenIn3D = true;
}

/** Flag read by the Culler, which must not re-enable objects the 3D renderer replaced. */
export type HiddenIn3D = Phaser.GameObjects.GameObject & { hiddenIn3D?: boolean };
