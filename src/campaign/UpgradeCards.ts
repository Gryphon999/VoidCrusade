export type CardId = 'veterans' | 'turrets' | 'warchest' | 'munitions' | 'ceramite' | 'deploy' | 'slot' | 'fluxres';

export interface CardDef {
  id: CardId;
  name: string;
  description: string;
  icon: string;
}

export const CARDS: CardDef[] = [
  { id: 'veterans', name: 'Veteran Squads', description: 'Squads start at +2 soldiers.', icon: 'icon_squads' },
  { id: 'turrets', name: 'Turret Overcharge', description: 'Turrets deal +20% damage.', icon: 'icon_turret' },
  { id: 'warchest', name: 'War Chest', description: 'Start each battle with an extra 300 Scrip.', icon: 'icon_scrip' },
  { id: 'munitions', name: 'Blessed Munitions', description: 'All units deal +10% damage.', icon: 'icon_damage' },
  { id: 'ceramite', name: 'Ceramite Stockpile', description: 'All units gain +10% HP.', icon: 'icon_cover' },
  { id: 'deploy', name: 'Rapid Deployment', description: 'Buildings construct 25% faster.', icon: 'icon_build' },
  { id: 'slot', name: 'Levy of the Faithful', description: '+1 squad slot.', icon: 'icon_squads' },
  { id: 'fluxres', name: 'Flux Reserves', description: 'Start each battle with an extra 150 Flux.', icon: 'icon_flux' },
];

export function getCard(id: CardId): CardDef {
  return CARDS.find((c) => c.id === id) as CardDef;
}

/** Three distinct random cards. */
export function drawCards(n = 3): CardDef[] {
  const pool = CARDS.slice();
  const out: CardDef[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
