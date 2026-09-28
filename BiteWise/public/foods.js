// Offline food database — typical US portions, works with no internet.
// Format: "name|kcal per unit|unit|aliases (comma separated)|allergens"
// Allergen codes: p peanut · n tree nut · d dairy · e egg · g gluten/wheat · s soy · f fish · c shellfish · z sesame
// Calories are rounded typical values; restaurant items use the chain's published regular size.
(function () {
  const RAW = `
# ---------- breakfast ----------
egg|78|egg|eggs,boiled egg,hard boiled egg,fried egg,poached egg|e
scrambled eggs|180|2 eggs|scrambled egg|e,d
omelette|300|omelette|omelet,cheese omelette|e,d
egg white|17|white|egg whites|e
bacon|45|slice|bacon strip,strips of bacon|
turkey bacon|35|slice||
sausage link|90|link|sausage,breakfast sausage,sausage links|
sausage patty|200|patty||
toast|80|slice|bread,slice of bread,white bread,wheat bread,whole wheat toast|g
toast with butter|115|slice|buttered toast|g,d
avocado toast|260|slice||g
peanut butter toast|270|slice|pb toast|g,p
bagel|280|bagel|plain bagel,everything bagel|g,z
bagel with cream cheese|380|bagel||g,d
english muffin|135|muffin||g
croissant|230|croissant||g,d,e
muffin|420|muffin|blueberry muffin,chocolate muffin,chocolate chip muffin|g,d,e
donut|260|donut|doughnut,glazed donut|g,d,e,s
pancake|90|pancake|pancakes,hotcake,hotcakes|g,d,e
waffle|100|waffle|eggo,eggo waffle,waffles|g,d,e
belgian waffle|410|waffle||g,d,e
french toast|230|slice||g,d,e
french toast sticks|90|stick||g,d,e
syrup|100|2 tbsp|maple syrup,pancake syrup|
cereal|150|bowl|cereal bowl,bowl of cereal,frosted flakes,cheerios,lucky charms,froot loops,cinnamon toast crunch,cocoa puffs|g
cereal with milk|230|bowl||g,d
oatmeal|160|bowl|oats,porridge,instant oatmeal|
overnight oats|320|jar||d
granola|240|1/2 cup||n
granola bar|120|bar|nature valley,chewy bar|n,s
protein bar|210|bar|clif bar,quest bar,rxbar|d,s,n
yogurt|150|cup|yoghurt,yogurt cup,yoplait|d
greek yogurt|130|cup|chobani,fage|d
yogurt parfait|280|cup|parfait|d,n
breakfast burrito|400|burrito||g,e,d
breakfast sandwich|450|sandwich||g,e,d
mcmuffin|310|sandwich|egg mcmuffin|g,e,d
sausage mcmuffin|400|sandwich|sausage mcmuffin with egg|g,e,d
hash browns|150|patty|hash brown|
chicken biscuit|450|biscuit||g,d
biscuit|200|biscuit||g,d
biscuits and gravy|450|plate||g,d
cinnamon roll|420|roll||g,d,e
pop tart|200|pastry|poptart,pop-tart,pop tarts|g,s
toaster strudel|180|pastry||g,s,e
grits|150|cup||
smoothie bowl|350|bowl|acai bowl|n
# ---------- fruit ----------
banana|105|banana|bananas|
apple|95|apple|apples|
orange|65|orange|oranges|
clementine|35|clementine|cutie,cuties,mandarin|
grapes|60|cup|grape|
strawberries|50|cup|strawberry|
blueberries|85|cup|blueberry|
raspberries|65|cup|raspberry|
blackberries|60|cup|blackberry|
watermelon|85|2 cups||
cantaloupe|55|cup|melon|
pineapple|80|cup||
mango|100|cup||
pear|100|pear||
peach|60|peach||
plum|30|plum||
kiwi|42|kiwi||
cherries|90|cup|cherry|
raisins|130|small box||
dried mango|160|1/3 cup||
fruit cup|90|cup|fruit salad,mixed fruit|
applesauce|90|cup|apple sauce,gogo squeez|
avocado|240|avocado||
# ---------- vegetables + sides ----------
guacamole|100|1/4 cup|guac|
carrots|30|cup|carrot,baby carrots,carrot sticks|
celery|10|stalks||
broccoli|55|cup||
cauliflower|30|cup||
spinach|10|cup||
green beans|40|cup||
peas|120|cup||
corn|130|ear|corn on the cob|
cucumber|15|cup||
tomato|22|tomato|tomatoes|
bell pepper|30|pepper||
salad|120|bowl|side salad,green salad,garden salad|
caesar salad|360|bowl||d,e,f,g
chicken salad|400|bowl||e
chef salad|450|bowl||e,d
coleslaw|150|cup||e
potato|160|potato|baked potato|
loaded baked potato|500|potato||d
mashed potatoes|230|cup|mashed potato|d
sweet potato|115|potato||
fries|365|medium|french fries,fry|
small fries|230|small||
large fries|490|large||
sweet potato fries|400|serving||
tater tots|200|serving|tots|
onion rings|350|serving||g,d,e
rice|205|cup|white rice|
brown rice|215|cup||
fried rice|340|cup||e,s
spanish rice|240|cup|mexican rice|
quinoa|220|cup||
baked beans|240|cup||
refried beans|220|cup||
black beans|225|cup|beans|
pinto beans|245|cup||
edamame|190|cup||s
corn bread|200|piece|cornbread|g,d,e
dinner roll|110|roll|roll,bread roll|g
garlic bread|200|slice||g,d
bread stick|150|stick|breadstick,breadsticks|g,d
tortilla|140|tortilla|flour tortilla|g
corn tortilla|60|tortilla||
mac and cheese|350|cup|mac n cheese,macaroni,macaroni and cheese,kraft mac|g,d
# ---------- pasta + mains ----------
pasta|220|cup|noodles,spaghetti noodles,penne|g
spaghetti|480|plate|spaghetti and meatballs,pasta with sauce|g
fettuccine alfredo|800|plate|alfredo,chicken alfredo|g,d
lasagna|400|piece||g,d,e
ravioli|350|cup||g,d,e
ramen|380|package|instant noodles,cup noodles,top ramen,cup of noodles,maruchan|g,s
pad thai|650|plate||p,e,s,c
lo mein|450|cup||g,s
chicken breast|230|breast|grilled chicken,chicken|
chicken thigh|210|thigh||
chicken nuggets|48|nugget|nuggets,mcnuggets,nugget|g
chicken tenders|120|tender|chicken strips,chicken strip,tenders|g,e
chicken wings|90|wing|wings,wing,hot wings,buffalo wings|
boneless wings|70|wing||g
fried chicken|320|piece||g
rotisserie chicken|250|serving||
chicken pot pie|700|pie||g,d
chicken parmesan|600|serving|chicken parm|g,d,e
turkey|150|3 oz|turkey slices,deli turkey|
ham|140|3 oz|deli ham|
steak|540|steak|ribeye,sirloin|
pork chop|300|chop||
pulled pork|350|cup||
meatloaf|300|slice||g,e
meatballs|70|meatball|meatball|g,e,d
salmon|370|fillet|grilled salmon|f
tuna|110|can|canned tuna|f
tuna sandwich|450|sandwich|tuna salad sandwich|g,f,e
fish sticks|50|stick|fish stick|f,g
fish and chips|800|plate||f,g
shrimp|7|shrimp||c
fried shrimp|340|serving||c,g
crab legs|200|serving|crab|c
sushi roll|300|roll|california roll,sushi|f,c,s,z
tofu|180|cup||s
soup|150|cup|chicken noodle soup,tomato soup|g
clam chowder|240|cup||c,d
chili|300|cup||
stir fry|450|plate||s
curry|500|plate||d
tikka masala|550|plate|chicken tikka masala|d
orange chicken|490|serving|panda express orange chicken|g,s,e
beijing beef|470|serving||g,s,e
kung pao chicken|290|serving||p,s,g
teriyaki chicken|450|plate||g,s
dumplings|60|dumpling|potstickers,dumpling,gyoza|g,s
egg roll|200|egg roll||g,e,s
spring roll|110|roll||g
gyro|600|gyro||g,d
falafel|60|ball||z
hummus|70|2 tbsp||z
poke bowl|600|bowl||f,s,z
burrito bowl|650|bowl|chipotle bowl,bowl|d
burrito|700|burrito|chipotle burrito|g,d
quesadilla|500|quesadilla||g,d
taco|170|taco|tacos,hard taco|d
soft taco|200|taco||g,d
nachos|550|plate||d
enchilada|320|enchilada||d
tamale|280|tamale||
empanada|300|empanada||g,e
frozen dinner|350|meal|lean cuisine,tv dinner|g,d
hot pocket|300|pocket|hot pockets|g,d,s
lunchable|350|pack|lunchables|g,d
# ---------- sandwiches + burgers + pizza ----------
chicken sandwich|440|sandwich|spicy chicken sandwich|g,e,d
turkey sandwich|350|sandwich||g
ham sandwich|350|sandwich||g
grilled cheese|400|sandwich|grilled cheese sandwich|g,d
pb&j|380|sandwich|pbj,peanut butter and jelly,peanut butter jelly sandwich,pb and j|g,p
blt|450|sandwich||g,e
club sandwich|600|sandwich||g,e,d
sub|500|6 inch|subway,sub sandwich,hoagie|g
footlong|1000|footlong|footlong sub|g
wrap|450|wrap|chicken wrap|g
burger|550|burger|hamburger|g
cheeseburger|600|burger||g,d
double cheeseburger|450|burger|mcdouble|g,d
big mac|590|burger||g,d,e,s,z
quarter pounder|520|burger|quarter pounder with cheese|g,d,z
whopper|670|burger||g,e,z
baconator|950|burger||g,d,e
veggie burger|400|burger|impossible burger,beyond burger|g,s
hot dog|290|hot dog|hotdog,hot dogs|g
corn dog|240|corn dog||g,e
sloppy joe|400|sandwich||g
pizza|285|slice|cheese pizza,slice of pizza,pizza slice|g,d
pepperoni pizza|315|slice|pepperoni|g,d
supreme pizza|340|slice|meat lovers pizza|g,d
personal pizza|700|pizza||g,d
pizza rolls|40|roll|totinos|g,d
calzone|900|calzone||g,d
mozzarella sticks|85|stick|mozzarella stick|g,d,e
# ---------- fast food extras ----------
mcchicken|400|sandwich||g,e,s
filet o fish|390|sandwich|filet-o-fish|f,g,d,e
chick fil a sandwich|440|sandwich|chick-fil-a sandwich,chickfila sandwich|g,d,e,p
chick fil a nuggets|250|8 count|chick-fil-a nuggets|g,d,e,p
waffle fries|420|medium|chick fil a fries|
crunchwrap|530|crunchwrap|crunchwrap supreme|g,d
chalupa|350|chalupa||g,d
cinnamon twists|170|order||g
frosty|350|small|wendys frosty|d
spicy chicken nuggets|430|10 count||g
chicken bowl|650|bowl|kfc bowl,famous bowl|g,d
popcorn chicken|400|serving||g
# ---------- snacks ----------
chips|150|1 oz bag|potato chips,lays,doritos,cheetos,bag of chips,pringles,ruffles|d
tortilla chips|140|1 oz||
chips and salsa|250|serving||
takis|150|1 oz||
hot cheetos|160|1 oz|flamin hot cheetos|d
popcorn|130|3 cups|microwave popcorn|d
movie popcorn|600|medium||d
pretzels|110|oz||g
pretzel|480|soft pretzel|soft pretzel,auntie annes|g,d
crackers|130|serving|ritz|g
goldfish|140|serving|goldfish crackers|g,d
cheez its|150|serving|cheez-its|g,d
graham crackers|120|2 sheets||g
rice cake|35|cake|rice cakes|
trail mix|170|1/4 cup||p,n
almonds|165|1/4 cup|almond|n
cashews|190|1/4 cup|cashew|n
peanuts|165|1/4 cup|peanut|p
mixed nuts|200|1/4 cup|nuts|n,p
sunflower seeds|190|1/4 cup||
beef jerky|80|oz|jerky|s
cheese|110|slice|cheese slice,american cheese,cheddar|d
string cheese|80|stick|cheese stick|d
cottage cheese|180|cup||d
babybel|70|piece||d
hard boiled egg|78|egg||e
fruit snacks|80|pouch|gushers|
fruit roll up|50|roll|fruit roll-up|
apple slices|30|bag||
veggie straws|130|serving||
ants on a log|200|serving||p
# ---------- sweets ----------
cookie|150|cookie|cookies,chocolate chip cookie|g,d,e,s
oreo|53|cookie|oreos|g,s
brownie|230|brownie||g,d,e
cupcake|300|cupcake||g,d,e
cake|350|slice|birthday cake,piece of cake,chocolate cake|g,d,e
cheesecake|400|slice||g,d,e
pie|320|slice|apple pie|g
pumpkin pie|320|slice||g,d,e
ice cream|270|cup||d
ice cream cone|250|cone||d,g
ice cream sandwich|180|sandwich||d,g
milkshake|550|medium|shake|d
mcflurry|510|regular||d,g,s
blizzard|600|small|dairy queen blizzard|d,g
frozen yogurt|220|cup|froyo|d
popsicle|60|pop||
candy bar|250|bar|kit kat,twix,hershey bar,chocolate bar,milky way,3 musketeers|d,s,g
snickers|250|bar||p,d,s,e
reeses|210|2 cups|reeses cups,peanut butter cups|p,d,s
chocolate|150|oz|dark chocolate|d,s
gummy bears|140|serving|gummies,gummy worms,sour patch kids|
skittles|250|bag|starburst|
m&ms|240|bag|m and ms|d,s
peanut m&ms|250|bag|peanut m and ms|p,d,s
jolly rancher|25|piece|hard candy|
lollipop|60|pop|sucker,blow pop|
cotton candy|110|serving||
pudding|110|cup||d
jello|70|cup|jell-o|
rice krispie treat|90|bar|rice krispies treat|
donut holes|200|4 holes|munchkins|g,d,e,s
churro|240|churro||g
funnel cake|760|cake||g,d,e
s'mores|200|smore|smores|g,d
# ---------- spreads + extras ----------
peanut butter|95|tbsp|pb|p
almond butter|100|tbsp||n
nutella|100|tbsp||n,d,s
jelly|50|tbsp|jam|
butter|100|tbsp||d
cream cheese|50|tbsp||d
mayo|90|tbsp|mayonnaise|e
ketchup|20|tbsp||
mustard|5|tsp||
ranch|130|2 tbsp|ranch dressing|d,e
bbq sauce|60|2 tbsp||
honey|60|tbsp||
salad dressing|120|2 tbsp|dressing,italian dressing|
olive oil|120|tbsp|oil|
sour cream|60|2 tbsp||d
salsa|10|2 tbsp||
gravy|30|1/4 cup||g
whipped cream|15|2 tbsp||d
# ---------- drinks ----------
milk|150|cup|glass of milk,whole milk|d
2% milk|120|cup|two percent milk|d
skim milk|85|cup||d
chocolate milk|200|cup||d
almond milk|40|cup||n
oat milk|120|cup||
soy milk|100|cup||s
orange juice|110|cup|oj,juice|
apple juice|115|cup||
juice box|90|box|capri sun,honest kids|
lemonade|120|cup||
sweet tea|90|cup|iced tea|
soda|150|can|coke,pepsi,sprite,dr pepper,coca cola,mountain dew,root beer,fanta|
large soda|290|large|big gulp|
diet soda|0|can|diet coke,coke zero,pepsi zero,sprite zero|
sparkling water|0|can|la croix,bubly,seltzer|
sports drink|140|bottle|gatorade,powerade|
gatorade zero|10|bottle|g zero|
energy drink|110|can|red bull,monster,celsius,bang|
prime|20|bottle|prime hydration|
coffee|5|cup|black coffee,americano|
coffee with milk|40|cup|coffee with cream|d
latte|190|grande|caffe latte|d
iced coffee|120|medium||d
cold brew|5|grande||
frappuccino|380|grande|frappe,mocha frappuccino,caramel frappuccino|d
pumpkin spice latte|390|grande|psl|d
refresher|90|grande|starbucks refresher,pink drink|d
hot chocolate|200|cup|hot cocoa|d
smoothie|300|medium||d
protein shake|160|shake|premier protein,fairlife shake|d
boba|450|medium|bubble tea,milk tea|d
slushie|200|medium|icee,slurpee|
water|0|glass||
beer|150|can||g
wine|125|glass||
`;
  const CODES = { p: 'peanut', n: 'tree nut', d: 'dairy', e: 'egg', g: 'gluten', s: 'soy', f: 'fish', c: 'shellfish', z: 'sesame' };
  window.BW_ALLERGENS = CODES;
  window.BW_FOODS = RAW.trim().split('\n').filter(l => l && l[0] !== '#').map(line => {
    const [name, kcal, unit, aliases, al] = line.split('|');
    return { name, kcal: +kcal, unit, aliases: [name, ...(aliases || '').split(',').map(s => s.trim()).filter(Boolean)], allergens: (al || '').split(',').map(c => CODES[c.trim()]).filter(Boolean) };
  });
})();
