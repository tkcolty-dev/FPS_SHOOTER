export const COOKIE_TYPES = [
  { id: 'thin-mints', name: 'Thin Mints', shortName: 'TM', color: '#4a8c5c', bg: '#e5f2e8' },
  { id: 'adventurefuls', name: 'Adventurefuls', shortName: 'AF', color: '#d4837a', bg: '#fae8e5' },
  { id: 'explore-mores', name: 'Explore Mores', shortName: 'EM', color: '#c9a832', bg: '#fdf4dc' },
  { id: 'lemonades', name: 'Lemonades', shortName: 'LM', color: '#d4b832', bg: '#fdf6d8' },
  { id: 'trefoils', name: 'Trefoils', shortName: 'TF', color: '#4a8ec9', bg: '#e0effa' },
  { id: 'pb-patties', name: 'PB Patties', shortName: 'PP', color: '#d04a2a', bg: '#fce0da' },
  { id: 'caramel-delites', name: 'Caramel deLites', shortName: 'CD', color: '#6b2d8e', bg: '#f0e0f7' },
  { id: 'pb-sandwich', name: 'PB Sandwich', shortName: 'PS', color: '#3a6b4a', bg: '#e0ede4' },
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
