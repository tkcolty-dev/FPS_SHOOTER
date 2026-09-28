// Builds public/usda-foods.json from the USDA FoodData Central "Survey (FNDDS)" download (public domain, CC0).
//   Download: https://fdc.nal.usda.gov/download-datasets/ → Survey Foods (FNDDS) JSON, unzip, then:
//   node tools/build-usda.js path/to/surveyDownload.json
// Output rows: [name, kcal per 100 g, [[portion label, grams], ...], allergen codes, category]
// Allergens are read from the food name + its ingredient list (typical recipes, not a guarantee).
const fs = require('fs'), path = require('path');
const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-usda.js surveyDownload.json'); process.exit(1); }
const foods = JSON.parse(fs.readFileSync(src, 'utf8')).SurveyFoods;

const RULES = {
  d: /\b(milk\w*|chees\w*|(?<!peanut |almond |apple |cashew |sunflower |nut |seed )butter|cream|yogurt|yoghurt|whey|casein|ice cream|custard|ghee|queso|parmesan|mozzarella|cheddar|ricotta|alfredo)\b/,
  e: /\b(eggs?|egg yolk|egg white|mayonnaise|mayo|meringue)\b/,
  g: /\b(wheat|flour|bread|breaded|pasta|macaroni|spaghetti|noodles?|crackers?|cookies?|cake|barley|rye|bun|rolls?|pizza|biscuits?|pastry|croissant|couscous|semolina|bagel|muffin|pancake|waffle|pretzel|beer|dough|crust|batter|cereal|tortilla, flour|flour tortilla|pita|graham|stuffing|dumpling|seitan|soy sauce|teriyaki)\b/,
  s: /\b(soy|soybeans?|tofu|edamame|miso|tempeh|soy sauce|teriyaki)\b/,
  p: /\b(peanuts?|peanut butter)\b/,
  n: /\b(almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamia|pine nuts?|brazil nuts?|nutella|praline|marzipan)\b/,
  f: /\b(fish|salmon|tuna|cod|tilapia|trout|catfish|sardines?|anchov(y|ies)|halibut|pollock|haddock|flounder|mackerel|sea bass|perch|swordfish|mahi|whitefish)\b/,
  c: /\b(shrimp|crab|lobster|clams?|oysters?|mussels?|scallops?|crayfish|crawfish|prawns?|squid|calamari|octopus)\b/,
  z: /\b(sesame|tahini|hummus)\b/,
};
// plant "milks" and nut-free look-alikes shouldn't trigger the matching allergen
const SCRUB = [/\b(almond|coconut|soy|oat|rice|cashew) milk\b/g, /\bcoconut\b/g, /\bpeanut oil\b/g, /\bsoybean oil\b/g, /\bcocoa butter\b/g, /\bbutternut\b/g, /\begg ?plant\b/g, /\bcream of tartar\b/g, /\bbuckwheat\b/g, /\bgluten[- ]free\b/g];

const tidy = s => s.replace(/, NFS\b/g, '').replace(/, NS as to [^,]+/g, '').replace(/\s+/g, ' ').trim();
const out = [];
for (const f of foods) {
  const kcal = f.foodNutrients.find(n => n.nutrient?.name === 'Energy' && n.nutrient.unitName === 'kcal')?.amount;
  if (kcal == null) continue;
  const name = tidy(f.description);
  let text = (f.description + ' ' + (f.inputFoods || []).map(i => i.foodDescription || i.ingredientDescription || '').join(' ')).toLowerCase();
  const plantMilkOnly = /\b(almond|soy|oat|rice|coconut) milk\b/.test(text);
  for (const r of SCRUB) text = text.replace(r, ' ');
  let al = Object.entries(RULES).filter(([, re]) => re.test(text)).map(([c]) => c);
  if (plantMilkOnly && /\b(almond)\b/.test(f.description.toLowerCase())) al = [...new Set([...al, 'n'])];
  if (plantMilkOnly && /\bsoy\b/.test(f.description.toLowerCase())) al = [...new Set([...al, 's'])];
  const ps = (f.foodPortions || []).filter(p => p.gramWeight > 0 && p.portionDescription).map(p => [p.portionDescription.replace('Quantity not specified', 'Typical serving'), Math.round(p.gramWeight * 10) / 10]);
  ps.sort((a, b) => (a[0] === 'Typical serving' ? -1 : b[0] === 'Typical serving' ? 1 : 0));
  const seen = new Set(), portions = ps.filter(p => !seen.has(p[0]) && seen.add(p[0])).slice(0, 5);
  if (!portions.length) portions.push(['100 g', 100]);
  out.push([name, Math.round(kcal), portions, al.join(''), f.wweiaFoodCategory?.wweiaFoodCategoryDescription || '']);
}
out.sort((a, b) => a[0].localeCompare(b[0]));
const dest = path.join(__dirname, '..', 'public', 'usda-foods.json');
fs.writeFileSync(dest, JSON.stringify({ source: 'USDA FoodData Central, Survey (FNDDS) 2024-10-31 — public domain', count: out.length, foods: out }));
console.log(`wrote ${out.length} foods → ${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
