export const COOKIE_TYPES = [
  { id: 'thin-mints', name: 'Thin Mints', shortName: 'TM', color: '#15803d', bg: '#dcfce7' },
  { id: 'adventurefuls', name: 'Adventurefuls', shortName: 'AF', color: '#7c3aed', bg: '#ede9fe' },
  { id: 'explore-mores', name: 'Explore Mores', shortName: 'EM', color: '#b45309', bg: '#fef3c7' },
  { id: 'lemonades', name: 'Lemonades', shortName: 'LM', color: '#ca8a04', bg: '#fef9c3' },
  { id: 'trefoils', name: 'Trefoils', shortName: 'TF', color: '#d97706', bg: '#ffedd5' },
  { id: 'pb-patties', name: 'PB Patties', shortName: 'PP', color: '#78350f', bg: '#fde68a' },
  { id: 'caramel-delites', name: 'Caramel deLites', shortName: 'CD', color: '#dc2626', bg: '#fee2e2' },
  { id: 'pb-sandwich', name: 'PB Sandwich', shortName: 'PS', color: '#ea580c', bg: '#ffedd5' },
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
