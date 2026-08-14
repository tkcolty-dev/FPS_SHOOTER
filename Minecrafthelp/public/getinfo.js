// "How to get it" knowledge for items with no crafting recipe:
// furnace smelting, ore mining info, mob drops, netherite upgrading, and more.

// result item -> what you smelt to get it (fuel is always shown as coal)
window.MC_SMELTS = {
  iron_ingot: 'raw_iron',
  gold_ingot: 'raw_gold',
  copper_ingot: 'raw_copper',
  netherite_scrap: 'ancient_debris',
  glass: 'sand',
  stone: 'cobblestone',
  smooth_stone: 'stone',
  smooth_sandstone: 'sandstone',
  smooth_red_sandstone: 'red_sandstone',
  smooth_quartz: 'quartz_block',
  smooth_basalt: 'basalt',
  brick: 'clay_ball',
  nether_brick: 'netherrack',
  charcoal: 'oak_log',
  cracked_stone_bricks: 'stone_bricks',
  cracked_deepslate_bricks: 'deepslate_bricks',
  cracked_nether_bricks: 'nether_bricks',
  cracked_polished_blackstone_bricks: 'polished_blackstone_bricks',
  deepslate: 'cobbled_deepslate',
  terracotta: 'clay',
  sponge: 'wet_sponge',
  popped_chorus_fruit: 'chorus_fruit',
  green_dye: 'cactus',
  lime_dye: 'sea_pickle',
  cooked_beef: 'beef',
  cooked_porkchop: 'porkchop',
  cooked_chicken: 'chicken',
  cooked_mutton: 'mutton',
  cooked_rabbit: 'rabbit',
  cooked_cod: 'cod',
  cooked_salmon: 'salmon',
  baked_potato: 'potato',
  dried_kelp: 'kelp',
};

// hand-written "how to get it" info. icons are item names.
const ORE = (pick, y, extra) => `Mine it with a ${pick} pickaxe or better. ${y}${extra ? ' ' + extra : ''}`;
window.MC_INFO = {
  // ---- ores (Y levels for current Minecraft) ----
  coal_ore: { text: ORE('wooden', 'Most common high up at Y 96 and in mountains.'), icons: ['wooden_pickaxe', 'coal'] },
  iron_ore: { text: ORE('stone', 'Most common at Y 16, and TONS in mountains above Y 128.'), icons: ['stone_pickaxe', 'raw_iron', 'iron_ingot'] },
  copper_ore: { text: ORE('stone', 'Most common at Y 48 — dripstone caves are full of it.'), icons: ['stone_pickaxe', 'raw_copper'] },
  gold_ore: { text: ORE('iron', 'Most common at Y -16.', 'Badlands biomes have extra gold at every height.'), icons: ['iron_pickaxe', 'raw_gold'] },
  redstone_ore: { text: ORE('iron', 'Most common at Y -59, near bedrock.'), icons: ['iron_pickaxe', 'redstone'] },
  diamond_ore: { text: ORE('iron', 'Most common at Y -59, near bedrock.', 'Fortune III gives you up to 4 diamonds per ore!'), icons: ['iron_pickaxe', 'diamond'] },
  lapis_ore: { text: ORE('stone', 'Most common at Y 0.'), icons: ['stone_pickaxe', 'lapis_lazuli'] },
  emerald_ore: { text: ORE('iron', 'ONLY in mountain biomes, most common at Y 232.', 'Trading with villagers is a much faster way to get emeralds.'), icons: ['iron_pickaxe', 'emerald'] },
  nether_gold_ore: { text: 'Mine with any pickaxe, all over the Nether. Drops gold nuggets.', icons: ['wooden_pickaxe', 'gold_nugget'] },
  nether_quartz_ore: { text: 'Mine with any pickaxe, all over the Nether. Great XP source!', icons: ['wooden_pickaxe', 'quartz'] },
  ancient_debris: { text: 'The rarest ore! Needs a DIAMOND pickaxe. Found only in the Nether, best at Y 8-22. Pro strategy: bed explosions or TNT mining (beds explode in the Nether!). Smelt it into Netherite Scrap.', icons: ['diamond_pickaxe', 'tnt', 'netherite_scrap'] },
  // ---- raw metals ----
  raw_iron: { text: 'Drops when you mine Iron Ore with a stone pickaxe or better. Smelt it into Iron Ingots.', icons: ['iron_ore', 'iron_ingot'] },
  raw_gold: { text: 'Drops when you mine Gold Ore with an iron pickaxe or better. Smelt it into Gold Ingots.', icons: ['gold_ore', 'gold_ingot'] },
  raw_copper: { text: 'Drops when you mine Copper Ore with a stone pickaxe or better. Smelt it into Copper Ingots.', icons: ['copper_ore', 'copper_ingot'] },
  // ---- gems / drops from mining ----
  diamond: { text: 'Mine Diamond Ore at Y -59 with an iron pickaxe or better. Also found in chests: shipwrecks, desert temples, bastions, end cities.', icons: ['diamond_ore', 'iron_pickaxe'] },
  emerald: { text: 'Trade with villagers (best way!), or mine Emerald Ore in mountains.', icons: ['emerald_ore'] },
  coal: { text: 'Mine Coal Ore with any pickaxe. Or smelt logs into Charcoal — it works exactly the same.', icons: ['coal_ore', 'charcoal'] },
  quartz: { text: 'Mine Nether Quartz Ore with any pickaxe in the Nether.', icons: ['nether_quartz_ore'] },
  lapis_lazuli: { text: 'Mine Lapis Ore (best at Y 0). You need it for enchanting!', icons: ['lapis_ore', 'enchanting_table'] },
  // ---- mob drops ----
  string: { text: 'Dropped by spiders. Also from breaking cobwebs, fishing, and cat gifts.', icons: ['spider_eye', 'cobweb'] },
  gunpowder: { text: 'Dropped by creepers (kill them before they explode!). Also ghasts and witches. Build the Creeper Farm in ▶ Build Tutorials for infinite gunpowder!', icons: ['creeper_spawn_egg', 'tnt'] },
  bone: { text: 'Dropped by skeletons. Craft into bone meal to instantly grow crops, or tame wolves with it.', icons: ['skeleton_spawn_egg', 'bone_meal'] },
  ender_pearl: { text: 'Dropped by endermen. Warped forests in the Nether are FULL of them. Also: trade gold with piglins.', icons: ['enderman_spawn_egg', 'gold_ingot'] },
  blaze_rod: { text: 'Dropped by blazes in Nether Fortresses. Block their fireballs with a shield! Needed for brewing and Eyes of Ender.', icons: ['blaze_spawn_egg', 'blaze_powder', 'ender_eye'] },
  slime_ball: { text: 'Dropped by slimes — found in swamps at night (full moon = more slimes) and in slime chunks underground below Y 40.', icons: ['slime_spawn_egg', 'sticky_piston'] },
  rotten_flesh: { text: 'Dropped by zombies. Safe-ish to eat in an emergency (75% chance of hunger effect). Trade it to cleric villagers!', icons: ['zombie_spawn_egg'] },
  leather: { text: 'Dropped by cows, horses, and hoglins. Needed for books and item frames.', icons: ['cow_spawn_egg', 'book'] },
  feather: { text: 'Dropped by chickens. Needed for arrows and fireworks.', icons: ['chicken_spawn_egg', 'arrow'] },
  egg: { text: 'Chickens lay them every 5-10 minutes. Throw one — 1 in 8 chance it spawns a chick!', icons: ['chicken_spawn_egg'] },
  ghast_tear: { text: 'Dropped by ghasts in the Nether. Shoot their fireball BACK at them for an achievement! Used for Regeneration potions.', icons: ['ghast_spawn_egg', 'potion'] },
  spider_eye: { text: 'Dropped by spiders and witches. Poisonous to eat! Used for potions.', icons: ['spider_spawn_egg'] },
  phantom_membrane: { text: "Dropped by phantoms — they only spawn if you haven't slept for 3+ nights. Repairs elytra and brews Slow Falling.", icons: ['phantom_spawn_egg', 'elytra'] },
  shulker_shell: { text: 'Dropped by shulkers in End Cities. 2 shells + a chest = Shulker Box, the best storage in the game!', icons: ['shulker_spawn_egg', 'shulker_box'] },
  wither_skeleton_skull: { text: 'Rare drop (2.5%) from wither skeletons in Nether Fortresses. Use a Looting III sword! You need 3 to summon the Wither.', icons: ['wither_skeleton_spawn_egg', 'soul_sand'] },
  nether_star: { text: 'Dropped by the WITHER boss. Summon it with 4 soul sand + 3 wither skeleton skulls in a T shape. Needed for beacons!', icons: ['wither_skeleton_skull', 'soul_sand', 'beacon'] },
  ink_sac: { text: 'Dropped by squid. Used for black dye and dark writing.', icons: ['squid_spawn_egg', 'black_dye'] },
  glow_ink_sac: { text: 'Dropped by glow squid, found in dark underground water. Makes signs and item frames GLOW.', icons: ['glow_squid_spawn_egg', 'glow_item_frame'] },
  honeycomb: { text: 'Shear a bee nest when it is full of honey (level 5). Put a campfire under it first so the bees stay calm! Waxes copper.', icons: ['shears', 'campfire', 'bee_nest'] },
  prismarine_shard: { text: 'Dropped by guardians at Ocean Monuments.', icons: ['guardian_spawn_egg', 'prismarine'] },
  prismarine_crystals: { text: 'Dropped by guardians, or break sea lanterns.', icons: ['guardian_spawn_egg', 'sea_lantern'] },
  heart_of_the_sea: { text: 'Found ONLY in buried treasure chests. Get a treasure map from shipwrecks or dolphins (feed them fish!). Makes a Conduit.', icons: ['filled_map', 'conduit'] },
  nautilus_shell: { text: 'Fishing, drowned drops, or wandering trader. You need 8 for a Conduit.', icons: ['fishing_rod', 'drowned_spawn_egg', 'conduit'] },
  // ---- structure / special loot ----
  elytra: { text: 'Found in End Ships (the floating boats next to End Cities), in an item frame behind the treasure room. The ONLY way to fly in survival!', icons: ['end_stone', 'firework_rocket'] },
  totem_of_undying: { text: 'Dropped by Evokers — found in Woodland Mansions and raids. Hold it and it saves you from death!', icons: ['evoker_spawn_egg'] },
  trident: { text: 'Dropped by drowned that are HOLDING a trident (rare). No crafting recipe — you have to fight for it!', icons: ['drowned_spawn_egg'] },
  saddle: { text: 'No recipe! Found in dungeon/temple/bastion chests, fishing, or trade with a leatherworker villager.', icons: ['chest', 'fishing_rod'] },
  name_tag: { text: 'No recipe! Found in dungeon chests, fishing, or trade with a librarian villager. Name a mob and it never despawns.', icons: ['chest', 'fishing_rod'] },
  enchanted_golden_apple: { text: 'CANNOT be crafted anymore! Super rare chest loot: dungeons, mineshafts, desert temples, bastions, ancient cities.', icons: ['golden_apple', 'chest'] },
  dragon_egg: { text: 'Appears on the portal after beating the Ender Dragon the FIRST time. It teleports when you click it — mine it with a piston or torch trick!', icons: ['dragon_head', 'piston', 'torch'] },
  dragon_head: { text: 'Found on End Ships, mounted on the front like a figurehead.', icons: ['end_stone'] },
  sculk_catalyst: { text: 'Found in the Deep Dark and Ancient Cities, or dropped by the WARDEN (good luck).', icons: ['sculk', 'echo_shard'] },
  echo_shard: { text: 'Found only in Ancient City chests, in the Deep Dark. Sneak — do not wake the Warden!', icons: ['sculk', 'recovery_compass'] },
  netherite_upgrade_smithing_template: { text: 'Found in Bastion Remnant chests in the Nether. You NEED one to make netherite gear! Copy it: 7 diamonds + 1 netherrack + the template.', icons: ['diamond', 'netherrack', 'smithing_table'] },
  wheat_seeds: { text: 'Break tall grass, or break grown wheat to get more seeds back.', icons: ['short_grass', 'wheat'] },
  obsidian: { text: 'Made when WATER touches a LAVA SOURCE block. Mine it with a diamond pickaxe (takes a while!). Pour water on lava pools to make more.', icons: ['water_bucket', 'lava_bucket', 'diamond_pickaxe'] },
  crying_obsidian: { text: 'Trade gold with piglins, or find it in ruined portals. Makes a Respawn Anchor so you can respawn in the Nether!', icons: ['gold_ingot', 'respawn_anchor'] },
  sponge: { text: 'Found in Ocean Monuments (sponge rooms), or dropped by Elder Guardians. Soaks up water!', icons: ['elder_guardian_spawn_egg', 'wet_sponge'] },
};

// netherite gear: explain the smithing upgrade
const NETHERITE_GEAR = ['netherite_sword','netherite_pickaxe','netherite_axe','netherite_shovel','netherite_hoe','netherite_helmet','netherite_chestplate','netherite_leggings','netherite_boots'];
for (const n of NETHERITE_GEAR) {
  const diamondVersion = n.replace('netherite', 'diamond');
  window.MC_INFO[n] = {
    text: `Not made at a crafting table! Use a SMITHING TABLE: put in a Netherite Upgrade template + your ${diamondVersion.replace(/_/g,' ')} + 1 Netherite Ingot. Keeps all your enchantments!`,
    icons: ['smithing_table', 'netherite_upgrade_smithing_template', diamondVersion, 'netherite_ingot', n],
  };
}
window.MC_INFO.netherite_ingot = {
  text: 'Crafted from 4 Netherite Scrap + 4 Gold Ingots (shapeless). Get scrap by smelting Ancient Debris from the Nether (Y 8-22, diamond pickaxe).',
  icons: ['ancient_debris', 'netherite_scrap', 'gold_ingot'],
};

// deepslate ore variants reuse the base ore info
for (const base of ['coal','iron','copper','gold','redstone','diamond','lapis','emerald']) {
  const b = window.MC_INFO[base + '_ore'];
  if (b) window.MC_INFO['deepslate_' + base + '_ore'] = {
    text: b.text + ' (This is the deepslate version, found below Y 0 — takes longer to mine.)',
    icons: b.icons,
  };
}

window.howToGet = function (name) {
  if (window.MC_SMELTS[name]) return { type: 'smelt', input: window.MC_SMELTS[name] };
  if (window.MC_INFO[name]) return { type: 'info', ...window.MC_INFO[name] };
  if (name.endsWith('_spawn_egg')) return { type: 'info', text: 'Spawn eggs are creative-mode only — you cannot get them in survival.', icons: [] };
  if (name.startsWith('music_disc_')) return { type: 'info', text: 'Music discs come from dungeon/ancient city chests, or get a creeper killed by a SKELETON arrow — it drops a random disc!', icons: ['creeper_spawn_egg', 'skeleton_spawn_egg', 'jukebox'] };
  return null;
};
