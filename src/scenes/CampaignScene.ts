import Phaser from 'phaser';

export class CampaignScene extends Phaser.Scene {
  constructor() {
    super('CampaignScene');
  }

  create(): void {
    this.add.text(20, 20, 'Campaign (coming soon)', { color: '#fff' });
  }
}
