// Generates public/data.js (items + recipes) from minecraft-data (Java 26.1.2).
// Run: node gen-data.mjs
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const mcData = require('minecraft-data')('26.1.2');

const items = {};
for (let id = 0; id < 2000; id++) {
  const it = mcData.items[id];
  if (it) items[id] = { n: it.name, d: it.displayName };
}

// Map item name -> real texture URL first, so recipe-variant picking can prefer textured items.
const texJsonEarly = JSON.parse(fs.readFileSync('node_modules/minecraft-assets/minecraft-assets/data/1.21.8/items_textures.json'));
const texturedNames = new Set();
for (const t of texJsonEarly) {
  if (t.texture && t.texture.match(/minecraft:(block|blocks|item|items)\/(.+)/)) texturedNames.add(t.name);
  if (fs.existsSync(`public/tex/item/${t.name}.png`)) texturedNames.add(t.name);
}
const hasTex = (id) => items[id] && texturedNames.has(items[id].n);

function variantScore(v) {
  const ids = v.inShape ? v.inShape.flat().filter(x => x != null) : (v.ingredients || []);
  if (!ids.length) return -1;
  let score = 0;
  if (ids.every(hasTex)) score += 10;
  if (ids.some(id => items[id] && items[id].n === 'oak_planks')) score += 3;
  if (ids.some(id => items[id] && items[id].n.startsWith('oak_'))) score += 1;
  return score;
}

const recipes = [];
for (const [resultId, variants] of Object.entries(mcData.recipes)) {
  if (!items[resultId]) continue;
  const v = [...variants].sort((a, b) => variantScore(b) - variantScore(a))[0];
  if (!v) continue;
  const entry = { r: Number(resultId), c: v.result.count || 1 };
  if (v.inShape) {
    // normalize to rows of ids/null
    entry.s = v.inShape.map(row => row.map(cell => (cell == null ? null : cell)));
  } else if (v.ingredients) {
    entry.i = v.ingredients;
  }
  recipes.push(entry);
}

// Map item name -> real texture URL, using the extracted game assets.
const texJson = JSON.parse(fs.readFileSync('node_modules/minecraft-assets/minecraft-assets/data/1.21.8/items_textures.json'));
const texByName = {};
for (const t of texJson) {
  if (!t.texture) continue;
  const m = t.texture.match(/minecraft:(block|blocks|item|items)\/(.+)/);
  if (!m) continue;
  const folder = m[1].startsWith('block') ? 'block' : 'item';
  const file = `public/tex/${folder}/${m[2]}.png`;
  if (fs.existsSync(file)) texByName[t.name] = `tex/${folder}/${m[2]}.png`;
}
// Prefer a flat item icon when one exists with the same name (better for GUI slots)
for (const t of texJson) {
  const file = `public/tex/item/${t.name}.png`;
  if (fs.existsSync(file)) texByName[t.name] = `tex/item/${t.name}.png`;
}
// Second pass for items the (older) mapping file doesn't know: match texture files
// directly by name, trying face-variants and un-waxed base names.
function findTexFile(name) {
  const tryNames = [name, name + '_side', name + '_top', name + '_front', name + '_still'];
  if (name.startsWith('waxed_')) tryNames.push(name.slice(6), name.slice(6) + '_side', name.slice(6) + '_top');
  const base = name.replace(/_(slab|stairs|wall|fence|fence_gate|pressure_plate|button)$/, '');
  if (base !== name) tryNames.push(base, base + '_planks', base + '_block', base + 's');
  for (const n of tryNames) {
    if (fs.existsSync(`public/tex/item/${n}.png`)) return `tex/item/${n}.png`;
    if (fs.existsSync(`public/tex/block/${n}.png`)) return `tex/block/${n}.png`;
  }
  return null;
}
for (const it of Object.values(items)) {
  if (!texByName[it.n]) {
    const f = findTexFile(it.n);
    if (f) texByName[it.n] = f;
  }
}

const out = `// Auto-generated from minecraft-data (Java 26.1.2) + real game textures (1.21.8 assets).
window.MC_ITEMS = ${JSON.stringify(items)};
window.MC_RECIPES = ${JSON.stringify(recipes)};
window.MC_TEX = ${JSON.stringify(texByName)};
`;
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/data.js', out);
console.log('items:', Object.keys(items).length, 'recipes:', recipes.length, 'bytes:', out.length);
