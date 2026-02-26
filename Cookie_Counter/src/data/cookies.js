export const COOKIE_TYPES = [
  { id: 'thin-mints', name: 'Thin Mints', shortName: 'TM', color: '#00b451', bg: '#d9f5e6', image: '/cookies/thin-mints.png' },
  { id: 'caramel-delites', name: 'Caramel deLites', shortName: 'CD', color: '#5c1f8b', bg: '#ece0f5', image: '/cookies/caramel-delites.png' },
  { id: 'pb-patties', name: 'PB Patties', shortName: 'PP', color: '#ee3124', bg: '#fdd9d6', image: '/cookies/pb-patties.png' },
  { id: 'pb-sandwich', name: 'PB Sandwich', shortName: 'PS', color: '#ff830c', bg: '#ffe8d4', image: '/cookies/pb-sandwich.png' },
  { id: 'adventurefuls', name: 'Adventurefuls', shortName: 'AF', color: '#d5ca9f', bg: '#f5f1e4', image: '/cookies/adventurefuls.png' },
  { id: 'explore-mores', name: 'Exploremores', shortName: 'EM', color: '#fcb89d', bg: '#fef0e9', image: '/cookies/exploremores.png' },
  { id: 'lemonades', name: 'Lemonades', shortName: 'LM', color: '#fff441', bg: '#fffce0', image: '/cookies/lemonades.png' },
  { id: 'trefoils', name: 'Trefoils', shortName: 'TF', color: '#1496d4', bg: '#d9f0fc', image: '/cookies/trefoils.png' },
];

export const PRICE_PER_BOX = 6;
export const BOXES_PER_CASE = 12;

export function getCookieById(id) {
  return COOKIE_TYPES.find(c => c.id === id);
}

export function getEmptyInventory(defaultCount = 0) {
  const inv = {};
  COOKIE_TYPES.forEach(c => { inv[c.id] = defaultCount; });
  return inv;
}
