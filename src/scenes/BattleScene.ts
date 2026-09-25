import Phaser from 'phaser';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  create(): void {
    this.add.text(20, 20, 'Battle (coming soon)', { color: '#fff' });
  }
}
