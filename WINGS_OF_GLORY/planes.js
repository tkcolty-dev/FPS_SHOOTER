// Aircraft roster. Art keys refer to window.ART (top-down SVGs from the original Scratch project).
// speed = max speed px/s, turn = deg/s at optimal speed, hp = hit points, size = length in px at zoom 1.
(function(){
const NATIONS = {
  usa:     {name:'USA',      flag:['#3c5aa6','#fff','#c62828'],  prop:['#5b6b3a','#3f4c2a'], jet:['#9aa0a6','#7d8389']},
  germany: {name:'Germany',  flag:['#111','#c62828','#f3c14b'],  prop:['#6c7160','#4d5747'], jet:['#8f949a','#6f757b']},
  ussr:    {name:'USSR',     flag:['#c62828','#c62828','#f3c14b'],prop:['#5f7d4b','#7a5a3a'], jet:['#b7bcc1','#9096a0']},
  britain: {name:'Britain',  flag:['#1d3f8f','#fff','#c62828'],  prop:['#4e5e3d','#6e5a3a'], jet:['#8a8f8c','#5d6f5a']},
  japan:   {name:'Japan',    flag:['#fff','#c62828','#fff'],     prop:['#7c8676','#4e5a4a'], jet:['#9aa0a6','#7d8389']},
  france:  {name:'France',   flag:['#1d3f8f','#fff','#c62828'],  prop:['#5f6a80','#46506a'], jet:['#8d98b0','#6a7590']},
  sweden:  {name:'Sweden',   flag:['#1d5fbf','#f3c14b','#1d5fbf'],prop:['#4c6a3f','#3a4f33'], jet:['#5f7a52','#40563a']},
};
const RANK_COST = { 1:[0,0], 2:[4200,900], 3:[11000,2400], 4:[24000,5200], 5:[52000,11000], 6:[110000,24000] };
const MISSILES = {
  // guidance: 'ir' (heat seeker), 'sarh' (semi-active radar — launcher must hold the lock), 'arh' (active radar, goes autonomous)
  // rearOnly: early IR seekers can only see the hot tailpipe, so you must be behind the target
  // fov: seeker gimbal half-angle (deg) — the missile loses the target if it slides outside
  // lockFov: acquisition half-angle from your nose · minRange: arming distance · fuse: proximity radius
  // boost/accel: motor burn seconds and thrust · drag: coast deceleration · ccm: resistance to flares (0=easily fooled)
  'aim-9b':  {art:'aim-9b-sidewinder', name:'AIM-9B Sidewinder', guidance:'ir',   rearOnly:true,  speed:1500, accel:2000, boost:2.2, drag:200, turn:70,  fov:25, lockFov:12, range:1400, minRange:320, fuse:22, dmg:95,  life:5.5, lockTime:1.1, ccm:0.15},
  'aim-9d':  {art:'aim-9d-sidewinder', name:'AIM-9D Sidewinder', guidance:'ir',   rearOnly:true,  speed:1700, accel:2200, boost:2.4, drag:190, turn:110, fov:35, lockFov:16, range:1700, minRange:300, fuse:24, dmg:110, life:6.0, lockTime:1.0, ccm:0.3},
  'aim-9e':  {art:'aim-9e-sidewinder', name:'AIM-9E Sidewinder', guidance:'ir',   rearOnly:true,  speed:1650, accel:2100, boost:2.3, drag:190, turn:95,  fov:40, lockFov:20, range:1600, minRange:300, fuse:24, dmg:105, life:6.0, lockTime:0.9, ccm:0.35},
  'aim-4a':  {art:'aim-4a-falcon',     name:'AIM-4A Falcon',     guidance:'ir',   rearOnly:true,  speed:1500, accel:1900, boost:1.8, drag:230, turn:60,  fov:20, lockFov:10, range:1300, minRange:340, fuse:0,  dmg:80,  life:5.0, lockTime:1.3, ccm:0.1},
  'aim-7':   {art:'aim-7b-sparrow',    name:'AIM-7B Sparrow',    guidance:'sarh', rearOnly:false, speed:1900, accel:2400, boost:3.0, drag:170, turn:80,  fov:45, lockFov:30, range:2600, minRange:500, fuse:30, dmg:140, life:8.0, lockTime:1.6, ccm:1},
  'aim-54':  {art:'aim-54c-phoenix',   name:'AIM-54C Phoenix',   guidance:'arh',  rearOnly:false, speed:2400, accel:2600, boost:4.5, drag:150, turn:85,  fov:50, lockFov:35, range:4200, minRange:800, fuse:36, dmg:200, life:11,  lockTime:2.0, ccm:1},
  'aim-120': {art:'aim-120-amraam',    name:'AIM-120 AMRAAM',    guidance:'arh',  rearOnly:false, speed:2300, accel:2800, boost:3.4, drag:150, turn:130, fov:55, lockFov:35, range:3600, minRange:600, fuse:30, dmg:170, life:9.0, lockTime:1.4, ccm:1},
  'r-3s':    {art:'r-3s-aa-2-atoll',   name:'R-3S Atoll',        guidance:'ir',   rearOnly:true,  speed:1500, accel:1950, boost:2.1, drag:210, turn:65,  fov:22, lockFov:11, range:1300, minRange:330, fuse:20, dmg:95,  life:5.5, lockTime:1.2, ccm:0.12},
  'r-13':    {art:'k-13r-aa-2c-atoll', name:'R-13M Atoll',       guidance:'ir',   rearOnly:true,  speed:1650, accel:2100, boost:2.4, drag:195, turn:100, fov:34, lockFov:17, range:1600, minRange:300, fuse:24, dmg:105, life:6.0, lockTime:1.0, ccm:0.3},
  'r-60':    {art:'r-60-vympel-aa-8-aphid',name:'R-60M Aphid',   guidance:'ir',   rearOnly:false, speed:1700, accel:2500, boost:1.6, drag:260, turn:150, fov:45, lockFov:25, range:1100, minRange:220, fuse:18, dmg:85,  life:4.5, lockTime:0.7, ccm:0.5},
  'r-23':    {art:'vympel-r-23-aa-7-apex',name:'R-23R Apex',     guidance:'sarh', rearOnly:false, speed:1900, accel:2400, boost:3.0, drag:175, turn:85,  fov:45, lockFov:30, range:2600, minRange:500, fuse:30, dmg:140, life:8.0, lockTime:1.6, ccm:1},
  'r-40':    {art:'r-40-aa-6-acrid',   name:'R-40D Acrid',       guidance:'sarh', rearOnly:false, speed:2200, accel:2500, boost:3.8, drag:160, turn:75,  fov:45, lockFov:32, range:3300, minRange:700, fuse:34, dmg:180, life:9.0, lockTime:1.8, ccm:1},
  'r-4':     {art:'r-4t-aa-5-ash',     name:'R-4T Ash',          guidance:'ir',   rearOnly:true,  speed:1600, accel:1900, boost:2.6, drag:210, turn:60,  fov:24, lockFov:12, range:2000, minRange:450, fuse:28, dmg:130, life:7.0, lockTime:1.5, ccm:0.15},
  'aa-3':    {art:'k-8-kalingrad-aa-3-anab',name:'R-8T Anab',    guidance:'ir',   rearOnly:true,  speed:1600, accel:1950, boost:2.4, drag:205, turn:65,  fov:26, lockFov:13, range:1900, minRange:420, fuse:26, dmg:120, life:7.0, lockTime:1.4, ccm:0.18},
};function guns(n, cal, opts){ // cal: 'mg' 7.7mm, 'hmg' 12.7mm, 'c20' 20mm, 'c30' 30mm, 'c37', 'gau' 30mm gatling, 'vulcan' 20mm gatling
  const table = {
    mg:    {dmg:2.0, rof:18, spread:2.2, range:520, speed:1500, col:'#ffe9a8', size:1.3},
    hmg:   {dmg:3.6,  rof:14, spread:1.9, range:620, speed:1650, col:'#ffd27a', size:1.7},
    c20:   {dmg:6.5, rof:9,  spread:1.6, range:640, speed:1600, col:'#ff9f4a', size:2.2},
    c23:   {dmg:8,   rof:9,  spread:1.7, range:660, speed:1650, col:'#ff9f4a', size:2.3},
    c30:   {dmg:15,  rof:6,  spread:1.9, range:620, speed:1500, col:'#ff7a3a', size:2.8},
    c37:   {dmg:26,  rof:3.2,spread:2.2, range:700, speed:1500, col:'#ff6a3a', size:3.2},
    vulcan:{dmg:4.5, rof:60, spread:1.4, range:740, speed:1900, col:'#ffd27a', size:1.8},
    gau:   {dmg:11,  rof:50, spread:1.6, range:800, speed:1900, col:'#ff8f3a', size:2.6},
    tur:   {dmg:2.8, rof:12, spread:3.0, range:560, speed:1500, col:'#ffe9a8', size:1.5, turret:true},
  };
  return Object.assign({n, cal}, table[cal], opts||{});
}
const P = [];
function add(o){ o.cost = RANK_COST[o.rank]; P.push(o); }
// -------- USA --------
add({id:'p40', art:'p-40c-curtis', name:'P-40C Warhawk', nation:'usa', rank:1, role:'Fighter', jet:false, speed:330, accel:70, turn:150, hp:115, size:70, guns:guns(4,'hmg'), flares:0, desc:'Sturdy early-war fighter with a heavy punch of .50 cals. Dives well, turns fair.'});
add({id:'p39', art:'p-39q', name:'P-39Q Airacobra', nation:'usa', rank:1, role:'Fighter', jet:false, speed:345, accel:74, turn:140, hp:110, size:68, guns:guns(1,'c37',{n:1}), guns2:guns(4,'hmg'), desc:'Mid-engine fighter with a 37mm cannon through the spinner. Slow firing, devastating hits.'});
add({id:'p51', art:'p-51d-mustang', name:'P-51D Mustang', nation:'usa', rank:2, role:'Fighter', jet:false, speed:400, accel:78, turn:138, hp:120, size:72, guns:guns(6,'hmg'), desc:'Fast, long-legged escort fighter. Boom and zoom — keep your speed up.'});
add({id:'p63', art:'p-63a-5', name:'P-63A Kingcobra', nation:'usa', rank:2, role:'Fighter', jet:false, speed:385, accel:80, turn:150, hp:125, size:70, guns:guns(1,'c37',{n:1}), guns2:guns(4,'hmg'), desc:'Improved Airacobra: better climb, better turn, same hammer of a cannon.'});
add({id:'p61', art:'p-61a-blackwidow-night', name:'P-61A Black Widow', nation:'usa', rank:2, role:'Heavy Fighter', jet:false, speed:355, accel:60, turn:105, hp:260, size:100, guns:guns(4,'c20'), turret:guns(4,'tur'), bombs:{n:4,dmg:220,r:90}, desc:'Twin-engine night fighter bristling with 20mm cannon and a remote turret.'});
add({id:'b25', art:'b-25j-1', name:'B-25J Mitchell', nation:'usa', rank:2, role:'Bomber', jet:false, speed:320, accel:50, turn:80, hp:380, size:110, guns:guns(8,'hmg',{spread:2.6}), turret:guns(2,'tur'), bombs:{n:8,dmg:260,r:110}, desc:'Strafer variant with eight nose guns and a full bomb bay. Hits ground targets hard.'});
add({id:'b17', art:'b-17e-flying-fortress', name:'B-17E Flying Fortress', nation:'usa', rank:3, role:'Bomber', jet:false, speed:310, accel:40, turn:62, hp:620, size:130, guns:null, turret:guns(6,'tur',{rof:22}), bombs:{n:12,dmg:300,r:130}, desc:'Heavy bomber with defensive guns covering every angle. Fly to the enemy base and level it.'});
add({id:'b24', art:'b-24-liberator2', name:'B-24 Liberator', nation:'usa', rank:3, role:'Bomber', jet:false, speed:325, accel:42, turn:60, hp:560, size:128, guns:null, turret:guns(6,'tur',{rof:20}), bombs:{n:14,dmg:300,r:130}, desc:'Long-range heavy bomber. Bigger bomb load than the Fortress, a little more fragile.'});
add({id:'p59', art:'p-59-a-airacomet', name:'P-59A Airacomet', nation:'usa', rank:3, role:'Jet Fighter', jet:true, speed:470, accel:60, turn:110, hp:150, size:76, guns:guns(1,'c37',{n:1}), guns2:guns(3,'hmg'), desc:"America's first jet. Fast in a straight line, lazy in the turn."});
add({id:'f86', art:'f-86a-sabre', name:'F-86A Sabre', nation:'usa', rank:4, role:'Jet Fighter', jet:true, speed:600, accel:85, turn:118, hp:170, size:78, guns:guns(6,'hmg',{rof:20}), desc:'Legend of the Korean skies. Superb handling at speed with six fast-firing .50s.'});
add({id:'f2h', art:'mcdonnell-f2h-banshee', name:'F2H-2 Banshee', nation:'usa', rank:4, role:'Jet Fighter', jet:true, speed:570, accel:80, turn:112, hp:175, size:80, guns:guns(4,'c20'), bombs:{n:4,dmg:240,r:100}, desc:'Carrier-borne jet with four 20mm cannon and a light bomb load.'});
add({id:'f4', art:'f-4b-phantom', name:'F-4B Phantom II', nation:'usa', rank:5, role:'Jet Fighter', jet:true, ab:true, speed:820, accel:110, turn:88, hp:230, size:96, guns:guns(1,'vulcan',{n:1}), missiles:[['aim-9d',4],['aim-7',2]], flares:12, desc:'Big, fast, brutal. Sidewinders and Sparrows plus a gun pod. The workhorse of the missile age.'});
add({id:'f104', art:'f-104c-starfighter', name:'F-104C Starfighter', nation:'usa', rank:5, role:'Interceptor', jet:true, ab:true, speed:920, accel:130, turn:72, hp:170, size:92, guns:guns(1,'vulcan',{n:1}), missiles:[['aim-9b',2]], flares:8, desc:'The missile with a man in it. Nothing outruns it — nothing turns worse either.'});
add({id:'a10', art:'a-10-warthog', name:'A-10A Thunderbolt II', nation:'usa', rank:5, role:'Attacker', jet:true, speed:520, accel:70, turn:96, hp:420, size:96, guns:guns(1,'gau',{n:1}), missiles:[['aim-9e',2]], bombs:{n:12,dmg:280,r:120}, flares:16, desc:'Titanium bathtub built around a 30mm Avenger cannon. Eats tanks for breakfast.'});
add({id:'b52', art:'b-52h-stratofortess-2', name:'B-52H Stratofortress', nation:'usa', rank:5, role:'Bomber', jet:true, speed:640, accel:40, turn:48, hp:900, size:170, guns:null, turret:guns(1,'vulcan',{n:1,turret:true,rof:40,range:600}), bombs:{n:40,dmg:320,r:150}, flares:24, desc:'Eight engines, forty bombs, a tail Vulcan. Carpet the enemy base.'});
add({id:'f14', art:'f-14b-tomcat-wings-out', name:'F-14B Tomcat', nation:'usa', rank:6, role:'Jet Fighter', jet:true, ab:true, speed:900, accel:125, turn:104, hp:250, size:104, guns:guns(1,'vulcan',{n:1}), missiles:[['aim-9e',4],['aim-54',4]], flares:24, desc:'Swing-wing fleet defender. Phoenix missiles reach out and touch someone at extreme range.'});
add({id:'f15', art:'f-15c-eagle', name:'F-15C Eagle', nation:'usa', rank:6, role:'Jet Fighter', jet:true, ab:true, speed:960, accel:140, turn:110, hp:260, size:100, guns:guns(1,'vulcan',{n:1}), missiles:[['aim-9e',4],['aim-120',4]], flares:30, desc:'Undefeated air-superiority fighter. AMRAAMs, Sidewinders, and thrust to spare.'});
// -------- GERMANY --------
add({id:'he112', art:'he-112', name:'He 112 B-0', nation:'germany', rank:1, role:'Fighter', jet:false, speed:300, accel:66, turn:158, hp:100, size:64, guns:guns(2,'c20'), guns2:guns(2,'mg'), desc:'Elegant early fighter with a pair of 20mm cannon. Nimble and quick to bite.'});
add({id:'bf109', art:'bf-109e', name:'Bf 109 E-3', nation:'germany', rank:1, role:'Fighter', jet:false, speed:340, accel:76, turn:148, hp:105, size:66, guns:guns(2,'c20'), guns2:guns(2,'mg'), desc:'Battle of Britain veteran. Cannon in the wings, machine guns in the cowl.'});
add({id:'fw190', art:'fw-190d-1', name:'Fw 190 D-9', nation:'germany', rank:2, role:'Fighter', jet:false, speed:405, accel:84, turn:132, hp:130, size:70, guns:guns(2,'c20'), guns2:guns(2,'hmg'), desc:'The Long-nose Dora. Fantastic roll and speed — slash and extend.'});
add({id:'do217', art:'do-217z', name:'Do 217 E-2', nation:'germany', rank:2, role:'Bomber', jet:false, speed:325, accel:48, turn:78, hp:400, size:112, guns:guns(1,'c20',{n:1}), turret:guns(3,'tur'), bombs:{n:8,dmg:280,r:110}, desc:'Fast medium bomber with a decent bomb bay and gun turrets.'});
add({id:'ta152c', art:'ta-152-c-1', name:'Ta 152 C-1', nation:'germany', rank:3, role:'Fighter', jet:false, speed:430, accel:86, turn:130, hp:135, size:72, guns:guns(1,'c30',{n:1}), guns2:guns(4,'c20'), desc:'Heavily armed Fw 190 successor. One 30mm plus four 20mm cannon — nothing survives a burst.'});
add({id:'ta152h', art:'ta-152-h-1', name:'Ta 152 H-1', nation:'germany', rank:3, role:'Fighter', jet:false, speed:450, accel:84, turn:142, hp:130, size:74, guns:guns(1,'c30',{n:1}), guns2:guns(2,'c20'), desc:'High-altitude long-wing variant. Turns beautifully for its speed.'});
add({id:'do335', art:'do-335a-0', name:'Do 335 A-0 Pfeil', nation:'germany', rank:3, role:'Heavy Fighter', jet:false, speed:470, accel:80, turn:112, hp:190, size:80, guns:guns(1,'c30',{n:1}), guns2:guns(2,'c20'), bombs:{n:2,dmg:260,r:100}, desc:'Push-pull twin engine arrow. Fastest piston fighter in the game.'});
add({id:'he177', art:'he-177-grief-camo', name:'He 177 A-5 Greif', nation:'germany', rank:3, role:'Bomber', jet:false, speed:335, accel:42, turn:60, hp:600, size:132, guns:guns(1,'c20',{n:1}), turret:guns(5,'tur'), bombs:{n:12,dmg:320,r:130}, desc:'Heavy bomber with a huge load. Fragile engines, but the bombs speak for themselves.'});
add({id:'me163', art:'me-163b-komet', name:'Me 163 B Komet', nation:'germany', rank:4, role:'Interceptor', jet:true, ab:true, speed:640, accel:170, turn:150, hp:95, size:60, guns:guns(2,'c30'), desc:'Rocket interceptor. Blistering acceleration and turn, paper-thin airframe, tiny ammo load.'});
add({id:'me262', art:'me-262a-1-swallow', name:'Me 262 A-1', nation:'germany', rank:4, role:'Jet Fighter', jet:true, speed:560, accel:70, turn:100, hp:165, size:78, guns:guns(4,'c30'), desc:'First operational jet fighter. Four 30mm cannon in the nose — one pass, one kill.'});
add({id:'ho229', art:'horten-229a-0', name:'Ho 229 A', nation:'germany', rank:4, role:'Jet Fighter', jet:true, speed:590, accel:78, turn:124, hp:150, size:74, guns:guns(2,'c30'), desc:'Flying wing stealth jet. Fast, turns surprisingly well, hard to spot.'});
add({id:'me264', art:'me-264', name:'Me 264 Amerika', nation:'germany', rank:4, role:'Bomber', jet:false, speed:340, accel:40, turn:52, hp:700, size:150, guns:null, turret:guns(5,'tur'), bombs:{n:16,dmg:320,r:140}, desc:'Trans-Atlantic heavy bomber. Enormous range, enormous bomb bay.'});
// -------- USSR --------
add({id:'yak1', art:'yak-1', name:'Yak-1', nation:'ussr', rank:1, role:'Fighter', jet:false, speed:335, accel:74, turn:156, hp:100, size:66, guns:guns(1,'c20',{n:1}), guns2:guns(2,'mg'), desc:'Light and lively. One 20mm through the prop hub and a pair of MGs.'});
add({id:'yak7', art:'yak-7', name:'Yak-7B', nation:'ussr', rank:1, role:'Fighter', jet:false, speed:340, accel:72, turn:150, hp:110, size:66, guns:guns(1,'c20',{n:1}), guns2:guns(2,'hmg'), desc:'Tougher Yak with heavy machine guns. Dependable dogfighter.'});
add({id:'il2', art:'ilyushin-il-2-sturmovik-blueprint-2', name:'Il-2 Sturmovik', nation:'ussr', rank:2, role:'Attacker', jet:false, speed:300, accel:60, turn:110, hp:300, size:76, guns:guns(2,'c23'), guns2:guns(2,'mg'), turret:guns(1,'tur'), bombs:{n:6,dmg:240,r:100}, desc:'The Flying Tank. Armored bathtub, twin 23mm cannon and bombs for ground targets.'});
add({id:'yak3', art:'yak-3', name:'Yak-3', nation:'ussr', rank:2, role:'Fighter', jet:false, speed:385, accel:88, turn:164, hp:105, size:64, guns:guns(1,'c20',{n:1}), guns2:guns(2,'hmg'), desc:'Best low-altitude turn fighter of the war. Out-turns everything at this tier.'});
add({id:'su9', art:'su-9-1946', name:'Su-9 (1946)', nation:'ussr', rank:3, role:'Jet Fighter', jet:true, speed:540, accel:68, turn:104, hp:160, size:78, guns:guns(1,'c37',{n:1}), guns2:guns(2,'c23'), desc:'Soviet twin-jet in the Me 262 mould, with a 37mm and two 23mm cannon.'});
add({id:'mig9', art:'mig-9m-fargo', name:'MiG-9', nation:'ussr', rank:3, role:'Jet Fighter', jet:true, speed:560, accel:72, turn:108, hp:155, size:76, guns:guns(1,'c37',{n:1}), guns2:guns(2,'c23'), desc:'First Soviet jet fighter. Twin engines, a big 37mm and two 23mm.'});
add({id:'il28', art:'il-28-beagle', name:'Il-28 Beagle', nation:'ussr', rank:4, role:'Bomber', jet:true, speed:580, accel:52, turn:66, hp:520, size:112, guns:guns(2,'c23'), turret:guns(2,'tur',{cal:'c23',dmg:10}), bombs:{n:12,dmg:300,r:130}, desc:'Jet bomber: quick enough to run from fighters, tough enough to take a few hits.'});
add({id:'mig19', art:'mig-19p-farmer', name:'MiG-19PT', nation:'ussr', rank:4, role:'Jet Fighter', jet:true, ab:true, speed:760, accel:105, turn:112, hp:180, size:82, guns:guns(2,'c30'), missiles:[['r-3s',2]], flares:0, desc:'First Soviet supersonic fighter. Two 30mm cannon and early Atoll missiles.'});
add({id:'su7', art:'su-7-fitter-a', name:'Su-7B Fitter', nation:'ussr', rank:5, role:'Attacker', jet:true, ab:true, speed:820, accel:115, turn:82, hp:260, size:94, guns:guns(2,'c30'), bombs:{n:6,dmg:300,r:120}, flares:8, desc:'Fast swept-wing attacker. Screams in low, drops, and screams out.'});
add({id:'mig21', art:'mig-21pf-fishbed-d', name:'MiG-21PFM', nation:'ussr', rank:5, role:'Interceptor', jet:true, ab:true, speed:880, accel:125, turn:96, hp:180, size:88, guns:guns(2,'c23'), missiles:[['r-13',2],['r-3s',2]], flares:8, desc:'Delta-wing rocket. Superb acceleration, decent turn, Atoll missiles.'});
add({id:'mig23', art:'mig-23-flogger-out', name:'MiG-23M Flogger', nation:'ussr', rank:5, role:'Jet Fighter', jet:true, ab:true, speed:900, accel:130, turn:90, hp:220, size:96, guns:guns(2,'c23'), missiles:[['r-60',4],['r-23',2]], flares:16, desc:'Swing-wing brawler. R-60 Aphids are tiny, agile, and everywhere.'});
add({id:'mig25', art:'mig-25a-foxbat-a', name:'MiG-25PD Foxbat', nation:'ussr', rank:6, role:'Interceptor', jet:true, ab:true, speed:1100, accel:150, turn:64, hp:260, size:110, guns:null, missiles:[['r-40',4],['r-60',2]], flares:24, desc:'Fastest thing in the sky. Steel giant with long-range Acrid missiles and no gun.'});
add({id:'mig29', art:'mig-29a', name:'MiG-29 Fulcrum', nation:'ussr', rank:6, role:'Jet Fighter', jet:true, ab:true, speed:940, accel:140, turn:118, hp:240, size:98, guns:guns(1,'c30',{n:1,rof:25}), missiles:[['r-60',4],['r-23',2]], flares:30, desc:'Superb close-in dogfighter. Out-turns the Eagle at the merge.'});
// -------- BRITAIN --------
add({id:'spit', art:'spitfire-mk1a', name:'Spitfire Mk Ia', nation:'britain', rank:1, role:'Fighter', jet:false, speed:340, accel:72, turn:160, hp:105, size:66, guns:guns(8,'mg'), desc:'The elliptical-wing legend. Eight Brownings and a turn nobody can follow.'});
add({id:'welly', art:'vickers-wellington', name:'Wellington Mk Ic', nation:'britain', rank:2, role:'Bomber', jet:false, speed:295, accel:42, turn:66, hp:480, size:118, guns:null, turret:guns(4,'tur'), bombs:{n:10,dmg:280,r:120}, desc:'Geodetic-frame bomber famous for absorbing punishment and flying home.'});
add({id:'lanc', art:'avro-lancaster-b1', name:'Lancaster B Mk I', nation:'britain', rank:3, role:'Bomber', jet:false, speed:320, accel:40, turn:58, hp:640, size:140, guns:null, turret:guns(6,'tur',{rof:24}), bombs:{n:16,dmg:340,r:140}, desc:'The heavy of Bomber Command. Massive bomb load, four Merlins, turrets fore and aft.'});
add({id:'meteor', art:'gloster-meteor-mk1', name:'Meteor F Mk 3', nation:'britain', rank:4, role:'Jet Fighter', jet:true, speed:580, accel:75, turn:116, hp:170, size:78, guns:guns(4,'c20'), desc:"The Allies' first jet in service. Four Hispanos and a sturdy twin-engine frame."});
add({id:'ef', art:'eurofighter', name:'Eurofighter Typhoon', nation:'britain', rank:6, role:'Jet Fighter', jet:true, ab:true, speed:980, accel:150, turn:124, hp:240, size:98, guns:guns(1,'c30',{n:1,rof:28}), missiles:[['aim-9e',4],['aim-120',4]], flares:30, desc:'Canard delta with thrust to burn. AMRAAMs at range, Sidewinders and a Mauser up close.'});
// -------- JAPAN --------
add({id:'a6m', art:'a6m', name:'A6M2 Zero', nation:'japan', rank:1, role:'Fighter', jet:false, speed:325, accel:70, turn:172, hp:90, size:66, guns:guns(2,'c20'), guns2:guns(2,'mg'), desc:'The tightest turning fighter of them all. No armor — never trade hits, just dance.'});
// -------- FRANCE --------
add({id:'d520', art:'d-520', name:'D.520', nation:'france', rank:1, role:'Fighter', jet:false, speed:330, accel:70, turn:152, hp:105, size:64, guns:guns(1,'c20',{n:1}), guns2:guns(4,'mg'), desc:"France's best of 1940. Hub cannon plus four wing MGs, sweet handling."});
add({id:'mb200', art:'mb-200', name:'M.B.200', nation:'france', rank:1, role:'Bomber', jet:false, speed:240, accel:36, turn:70, hp:360, size:112, guns:null, turret:guns(3,'tur'), bombs:{n:8,dmg:240,r:110}, desc:'Boxy interwar bomber. Slow and ugly, but it carries a proper bomb load.'});
add({id:'ouragan', art:'md-450-ouragan', name:'M.D.450 Ouragan', nation:'france', rank:4, role:'Jet Fighter', jet:true, speed:590, accel:82, turn:120, hp:165, size:76, guns:guns(4,'c20'), bombs:{n:2,dmg:240,r:100}, desc:"France's first jet fighter. Balanced, forgiving, four 20mm cannon."});
add({id:'mirage', art:'mirage-iii-e', name:'Mirage IIIE', nation:'france', rank:5, role:'Jet Fighter', jet:true, ab:true, speed:900, accel:125, turn:94, hp:200, size:92, guns:guns(2,'c30'), missiles:[['aim-9b',2]], flares:8, desc:'Tailless delta. Very fast, bleeds speed in turns — keep the energy.'});
// -------- SWEDEN --------
add({id:'j21', art:'j-21', name:'J 21A', nation:'sweden', rank:2, role:'Fighter', jet:false, speed:370, accel:76, turn:136, hp:125, size:72, guns:guns(1,'c20',{n:1}), guns2:guns(4,'hmg'), desc:'Twin-boom pusher fighter with the guns concentrated in the nose.'});
add({id:'j21r', art:'j-21r', name:'J 21RA', nation:'sweden', rank:3, role:'Jet Fighter', jet:true, speed:520, accel:70, turn:118, hp:150, size:74, guns:guns(1,'c20',{n:1}), guns2:guns(4,'hmg'), desc:'The J 21 with a jet in place of the piston engine. Rare and quick.'});
add({id:'draken', art:'saab-35-draken', name:'J 35D Draken', nation:'sweden', rank:5, role:'Interceptor', jet:true, ab:true, speed:920, accel:130, turn:100, hp:190, size:92, guns:guns(2,'c30'), missiles:[['aim-9b',4]], flares:12, desc:'Double-delta interceptor. Ferocious acceleration and a surprisingly good turn.'});

P.forEach(p=>{ p.br = (p.rank + (p.jet?0.5:0) + (p.role==='Bomber'?-0.3:0)).toFixed(1);
  // fuel in seconds of full-throttle flight; climb rate px/s
  p.fuel = p.fuel || (p.role==='Bomber' ? 30*60 : p.jet ? (p.ab? 11*60 : 14*60) : 22*60);
  p.climb = p.climb || Math.round(p.jet ? p.speed*0.45 : p.speed*0.34);
});
window.NATIONS = NATIONS; window.PLANES = P; window.MISSILES = MISSILES; window.RANK_COST = RANK_COST;
window.planeById = id => P.find(p=>p.id===id);
})();
