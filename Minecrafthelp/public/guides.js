// Survival + Redstone guide content. Icons are real Minecraft item/block names.
// ed: = edition note (Bedrock vs Java), tip: = pro tip.

window.SURVIVAL_GUIDE = [
  {
    title: 'Your First Day',
    icon: 'oak_log',
    steps: [
      { text: 'Punch trees to collect at least 6 logs. Turn logs into planks, and planks into a **Crafting Table**.', icons: ['oak_log','oak_planks','crafting_table'] },
      { text: 'Craft a Wooden Pickaxe (3 planks on top, 2 sticks down the middle). Mine 3 stone, then craft Stone tools — a pickaxe, axe, and sword.', icons: ['wooden_pickaxe','cobblestone','stone_pickaxe','stone_sword','stone_axe'] },
      { text: 'Kill 3 sheep for wool and craft a **Bed**. Sleeping skips the night so mobs never come out.', icons: ['white_wool','red_bed'], tip: 'No sheep? Dig a small hole in a hillside and wall yourself in for the night.' },
      { text: 'Make a Furnace from 8 cobblestone. Cook any meat you got, and smelt logs into charcoal for torches.', icons: ['furnace','charcoal','torch'] },
      { text: 'Place torches inside and around your shelter. Mobs only spawn in the dark!', icons: ['torch'], ed: 'Bedrock: mobs spawn at light level 0 only. Same on Java since 1.18.' },
    ],
  },
  {
    title: 'Tools, Mining & Diamonds',
    icon: 'diamond_pickaxe',
    steps: [
      { text: 'Tool tiers: Wood → Stone → Iron → Diamond → Netherite. You need an **Iron Pickaxe** (or better) to mine diamonds, and a Stone Pickaxe to mine iron.', icons: ['wooden_pickaxe','stone_pickaxe','iron_pickaxe','diamond_pickaxe','netherite_pickaxe'] },
      { text: 'Find iron ore in caves or mountains, smelt it in a furnace. Craft an iron pickaxe, bucket, shield, and armor.', icons: ['iron_ore','iron_ingot','bucket','shield','iron_chestplate'] },
      { text: 'Diamonds are most common at **Y = -59**. Press F3 on Java or turn on coordinates in Bedrock settings to see your Y level.', icons: ['diamond_ore','diamond'], ed: 'Bedrock: Settings → Game → Show Coordinates. Java: press F3.' },
      { text: 'Dig a staircase down to Y -59, then branch mine: dig tunnels 2 blocks tall, leaving 2 blocks between each tunnel. Bring water for lava!', icons: ['water_bucket','torch'], tip: 'NEVER dig straight down — you can fall into lava.' },
      { text: 'To upgrade to Netherite: find Ancient Debris in the Nether (Y 8–22), smelt it into scrap, combine 4 scrap + 4 gold ingots for a Netherite Ingot, then use a **Smithing Table** + Netherite Upgrade template.', icons: ['ancient_debris','netherite_scrap','gold_ingot','netherite_ingot','smithing_table'] },
    ],
  },
  {
    title: 'Food & Farms',
    icon: 'bread',
    steps: [
      { text: 'Break tall grass for wheat seeds. Craft a **Hoe**, till dirt near water, and plant seeds. Wheat makes bread (3 wheat in a row).', icons: ['wheat_seeds','stone_hoe','wheat','bread'] },
      { text: 'Crops need light and grow faster near water. Bone meal (from skeleton bones) makes them grow instantly!', icons: ['bone','bone_meal'] },
      { text: 'Breed animals: wheat for cows and sheep, carrots for pigs, seeds for chickens. Two fed animals make a baby.', icons: ['wheat','carrot','wheat_seeds','egg'] },
      { text: 'Best foods: Steak and Cooked Porkchop (best saturation), Golden Carrots (late game), Bread (easy early).', icons: ['cooked_beef','cooked_porkchop','golden_carrot','bread'] },
      { text: 'Want automatic farms? Check the **▶ Build Tutorials** tab — the sugar cane and wheat farms build themselves in front of you!', icons: ['sugar_cane','observer','piston'] },
    ],
  },
  {
    title: 'The Nether',
    icon: 'obsidian',
    steps: [
      { text: 'Build a Nether Portal: a frame of 10 obsidian (corners optional), then light the inside with **Flint and Steel**. Mine obsidian with a diamond pickaxe, or cast a portal with lava + water.', icons: ['obsidian','flint_and_steel'] },
      { text: 'GEAR UP first: iron or diamond armor, shield, bow, food, blocks, and a fire resistance potion if you have one. Never bring stuff you are scared to lose.', icons: ['iron_chestplate','shield','bow','cobblestone'] },
      { text: 'Find a **Nether Fortress** for Blaze Rods (needed for potions and Eyes of Ender). Blazes drop them — block their fireballs with a shield.', icons: ['blaze_rod','blaze_powder'] },
      { text: 'Kill Endermen (warped forests have tons) or trade with Piglins using gold ingots to get **Ender Pearls**.', icons: ['ender_pearl','gold_ingot'] },
      { text: 'Piglins attack unless you wear at least ONE piece of gold armor. Toss them gold ingots for random loot including pearls.', icons: ['golden_boots','gold_ingot'], ed: 'Bedrock: piglin bartering loot chances are slightly different, but pearls drop in both.' },
    ],
  },
  {
    title: 'Enchanting & Potions',
    icon: 'enchanting_table',
    steps: [
      { text: 'Craft an **Enchanting Table**: 4 obsidian + 2 diamonds + 1 book. Surround it with 15 bookshelves (one block gap) for level-30 enchants.', icons: ['enchanting_table','bookshelf','lapis_lazuli'] },
      { text: 'Enchanting costs XP levels AND lapis lazuli. Best picks: **Mending**, Unbreaking III, Efficiency V (tools), Sharpness V (sword), Protection IV (armor), Fortune III (pickaxe — more diamonds per ore!).', icons: ['enchanted_book','experience_bottle'] },
      { text: 'Use an **Anvil** to combine enchanted books with your gear, and to repair items.', icons: ['anvil','enchanted_book'] },
      { text: 'Brewing: craft a **Brewing Stand** with 1 blaze rod + 3 cobblestone. Add blaze powder as fuel, water bottles below, and a Nether Wart first to make Awkward Potions.', icons: ['brewing_stand','blaze_powder','glass_bottle','nether_wart'] },
      { text: 'Must-have potions: Fire Resistance (magma cream), Healing (glistering melon), Strength (blaze powder), Night Vision (golden carrot).', icons: ['magma_cream','glistering_melon_slice','golden_carrot','potion'] },
    ],
  },
  {
    title: 'The End & the Dragon',
    icon: 'dragon_egg',
    steps: [
      { text: 'Craft **Eyes of Ender** (ender pearl + blaze powder). You need about 12 for the portal plus extras for finding it. Throw one and follow where it flies.', icons: ['ender_eye','ender_pearl','blaze_powder'] },
      { text: 'The eye leads to a **Stronghold** underground. Find the portal room and fill the 12 frames with Eyes of Ender.', icons: ['end_portal_frame','ender_eye'] },
      { text: 'Bring: full enchanted armor, a bow with LOTS of arrows (or Infinity), sword, food, blocks, water bucket, and slow falling potions.', icons: ['diamond_chestplate','bow','arrow','cobblestone','water_bucket'] },
      { text: 'FIRST destroy the End Crystals on the obsidian towers with your bow — they heal the dragon. Watch out, they explode!', icons: ['end_crystal','bow'] },
      { text: 'Hit the dragon with arrows when it flies, and with your sword when it perches on the center portal. Do NOT hit it with arrows while perched (they bounce off... actually they work, but the head is the weak spot!).', icons: ['diamond_sword','arrow'], ed: 'Bedrock: the dragon has slightly different perch timing and its breath lingers longer — keep your distance from the purple clouds.' },
      { text: 'After the win: grab the egg with a piston or torch trick, then explore End Cities for **Elytra** wings!', icons: ['dragon_egg','elytra','firework_rocket'] },
    ],
  },
  {
    title: 'Villagers & Trading',
    icon: 'emerald',
    steps: [
      { text: 'Villagers trade items for **emeralds** — often the fastest way to get diamonds gear, enchanted books, and rare stuff. Find a village or cure a zombie villager for HUGE discounts.', icons: ['emerald','golden_apple','potion'] },
      { text: 'A jobless villager + a job block = a working villager. Best jobs: **Librarian** (lectern) sells enchanted books, **Farmer** (composter) buys crops, **Cleric** (brewing stand) buys rotten flesh!, **Armorer** (blast furnace) sells diamond armor.', icons: ['lectern','composter','brewing_stand','blast_furnace'] },
      { text: 'Librarian trick: place the lectern, check the book trade, and if it is bad, BREAK the lectern and place it again — the trade rerolls until you lock it in by trading once.', icons: ['lectern','enchanted_book'] },
      { text: 'Trade with a villager enough and it levels up (novice → master) and unlocks better trades. Emerald farming: grow a big crop farm and sell to farmers.', icons: ['wheat','carrot','emerald'] },
      { text: 'Cure a zombie villager: weakness potion (splash) + golden apple. Takes a few minutes. Cured villagers give you near-1-emerald prices forever!', icons: ['splash_potion','golden_apple'], ed: 'Bedrock: discounts from curing are permanent and stack — cure the same villager twice for even better prices.' },
    ],
  },
  {
    title: 'Bosses: Wither & Warden',
    icon: 'nether_star',
    steps: [
      { text: 'Summon the **WITHER**: 4 soul sand in a T shape + 3 wither skeleton skulls on top. Build it far from your base — the explosion is huge!', icons: ['soul_sand','wither_skeleton_skull'] },
      { text: 'Wither strategy: fight it underground or at bedrock so it cannot fly away. Bring milk buckets (cures the Wither effect), golden apples, and a Smite sword.', icons: ['milk_bucket','golden_apple','diamond_sword'], ed: 'Bedrock: the Wither is MUCH harder — it has more health and a charge attack. Bring extra everything.' },
      { text: 'It drops a **Nether Star** — craft a BEACON (glass + obsidian + star) for superpowers like Haste and Speed near your base!', icons: ['nether_star','beacon','glass','obsidian'] },
      { text: 'The **WARDEN** lives in the Deep Dark. It is blind — it hunts by SOUND and smell. You are not supposed to fight it (it does 15 hearts per hit!). Sneak, throw snowballs to distract it, and loot the Ancient City.', icons: ['sculk_sensor','snowball','echo_shard'] },
      { text: 'Warden survival rules: crouch-walk everywhere, place wool over sculk sensors (wool blocks sound), never trigger 3 shrieker screams, and if it spawns... RUN.', icons: ['white_wool','sculk_shrieker'], tip: 'Ancient City loot is worth it: enchanted golden apples, echo shards for the Recovery Compass, and Swift Sneak books!' },
    ],
  },
  {
    title: 'Trial Chambers',
    icon: 'trial_key',
    steps: [
      { text: 'Trial Chambers are copper-and-tuff dungeons underground full of **Trial Spawners** — they spawn waves of mobs scaled to your party size, then give out loot!', icons: ['copper_block','tuff_bricks','trial_key'] },
      { text: 'Beat a trial spawner to get **Trial Keys** — use them on Vaults (the block with the keyhole) for rewards. Each player can loot each vault ONCE.', icons: ['trial_key','emerald','diamond'] },
      { text: 'Drink an **Ominous Bottle** (dropped by raid captains) to start harder OMINOUS trials — better loot, including Heavy Cores.', icons: ['ominous_bottle','heavy_core'] },
      { text: 'The **MACE** is crafted from a Heavy Core + Breeze Rod. Smash attack: the further you FALL before hitting, the more damage — you can one-shot anything and take no fall damage!', icons: ['mace','heavy_core','breeze_rod'] },
      { text: 'Breezes shoot wind charges that knock you around. Kill them for **Breeze Rods** and craft Wind Charges to jump-boost yourself!', icons: ['breeze_rod','wind_charge'], ed: 'Same on Bedrock and Java. Find chambers with a Trial Explorer map from cartographer villagers.' },
    ],
  },
];

window.REDSTONE_GUIDE = [
  {
    title: 'Redstone Components',
    icon: 'redstone',
    steps: [
      { text: '**Redstone Dust** carries power up to 15 blocks. Power fades 1 level per block — use repeaters to refresh it.', icons: ['redstone'] },
      { text: '**Redstone Torch**: always ON, but turns OFF when the block it is attached to gets powered. This is how you make a NOT gate (an inverter).', icons: ['redstone_torch'] },
      { text: '**Repeater**: boosts signal back to 15, adds delay (right-click to set 1–4 ticks), and only lets power flow one way.', icons: ['repeater'] },
      { text: '**Comparator**: compares signals, subtracts, and can READ containers — it outputs a signal based on how full a chest/hopper is. Key for item sorters.', icons: ['comparator'] },
      { text: '**Observer**: watches the block in front of its face and sends a quick pulse when it changes. Perfect for detecting growing crops.', icons: ['observer'], ed: 'Bedrock: observers pulse twice in some cases and detect slightly different updates than Java — most farm designs still work in both.' },
      { text: '**Piston** pushes blocks; **Sticky Piston** pushes AND pulls. Pistons can push up to 12 blocks in a row.', icons: ['piston','sticky_piston','slime_ball'] },
      { text: '**Hopper**: collects items from above and passes them into containers. Point it into a chest by sneaking while placing.', icons: ['hopper','chest'], ed: 'Bedrock: hoppers collect items a bit differently in minecarts, but chest hoppers work the same.' },
      { text: 'Power sources: **Lever** (stays on), **Button** (short pulse), **Pressure Plate** (stand on it), **Target Block** (shoot it), **Daylight Detector** (sun-powered).', icons: ['lever','stone_button','oak_pressure_plate','target','daylight_detector'] },
    ],
  },
  {
    title: 'Machines You Should Build',
    icon: 'piston',
    steps: [
      { text: '**Automatic Door**: put pressure plates on both sides of an iron door. Walk up = it opens. Iron doors ignore zombies!', icons: ['iron_door','stone_pressure_plate'] },
      { text: '**Piston Door (2x2)**: watch it build itself in the ▶ Build Tutorials tab, block by block.', icons: ['sticky_piston','redstone','lever'] },
      { text: '**Automatic Sugar Cane Farm**: observer watches the cane, fires a piston that chops it, water pushes it to a hopper + chest. In ▶ Build Tutorials.', icons: ['sugar_cane','observer','piston','hopper'] },
      { text: '**Mob XP Grinder**: a dark room where mobs spawn, water pushes them into a drop chute, and you collect the XP + loot. In ▶ Build Tutorials.', icons: ['rotten_flesh','bone','gunpowder','experience_bottle'] },
      { text: '**TNT Trap**: pressure plate + TNT hidden under sand. Careful — it destroys your own stuff too!', icons: ['tnt','sand','stone_pressure_plate'], tip: 'Test dangerous builds in a creative world first.' },
      { text: '**Item Sorter** (advanced): a row of hoppers with comparators sorts your loot into chests automatically. Ask the AI tab for a step-by-step!', icons: ['hopper','comparator','chest','redstone_torch'] },
    ],
  },
  {
    title: 'Bedrock vs Java Redstone',
    icon: 'command_block',
    steps: [
      { text: 'Bedrock redstone is "randomized" in update order; Java is deterministic. Simple machines work identically — very tight timing machines may need tweaks.', icons: ['redstone','repeater'] },
      { text: 'On Bedrock, pistons take 1 extra tick to retract, and there is no "quasi-connectivity" (Java BUD switches do not work).', icons: ['piston'] },
      { text: 'Bedrock exclusive tricks: movable chests and furnaces with pistons! Java cannot push containers.', icons: ['chest','furnace','sticky_piston'] },
      { text: 'All the tutorials in this app are tested designs that work on **both** editions unless a purple note says otherwise.', icons: ['book'] },
    ],
  },
];

window.CHAT_SUGGESTIONS = [
  'How do I make a beacon?',
  'Best enchantments for a sword?',
  'How do I find a woodland mansion?',
  'How do I cure a zombie villager?',
  'Make me an item sorter tutorial',
  'What does a conduit do?',
];
