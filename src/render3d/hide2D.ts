import type Phaser from 'phaser';

/**
 * Marks a 2D battlefield object as replaced by the 3D renderer: the battle camera stops drawing
 * it, while gameplay code keeps using it (positions, visibility, frames) as before.
 * A scene opts in by setting `render3d = true` before it creates its world objects.
 */
export function hide2D(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject): void {
  if ((scene as Phaser.Scene & { render3d?: boolean }).render3d) scene.cameras.main.ignore(obj);
}
