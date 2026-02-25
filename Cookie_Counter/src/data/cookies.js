export const COOKIE_TYPES = [
  { id: 'thin-mints', name: 'Thin Mints', shortName: 'TM', color: '#2e8b57', bg: '#e0f5ea' },
  { id: 'adventurefuls', name: 'Adventurefuls', shortName: 'AF', color: '#c97068', bg: '#fbe8e6' },
  { id: 'explore-mores', name: 'Explore Mores', shortName: 'EM', color: '#d4a843', bg: '#fdf4dc' },
  { id: 'lemonades', name: 'Lemonades', shortName: 'LM', color: '#4a9ec9', bg: '#e0f0fa' },
  { id: 'trefoils', name: 'Trefoils', shortName: 'TF', color: '#3b7dd8', bg: '#e0ebfa' },
  { id: 'pb-patties', name: 'PB Patties', shortName: 'PP', color: '#d86a2c', bg: '#fde8d8' },
  { id: 'caramel-delites', name: 'Caramel deLites', shortName: 'CD', color: '#7b2d8e', bg: '#f3e4f7' },
  { id: 'pb-sandwich', name: 'PB Sandwich', shortName: 'PS', color: '#8b2332', bg: '#f8e0e3' },
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
