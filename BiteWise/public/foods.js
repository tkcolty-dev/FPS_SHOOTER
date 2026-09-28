// Offline food list — typical US portions. Format: "name|kcal per unit|unit|aliases (comma separated)"
// Used by voice + text logging when there's no internet. Calories are rounded, typical values.
window.BW_FOODS = `
egg|78|egg|eggs,boiled egg,hard boiled egg,fried egg
scrambled eggs|180|2 eggs|scrambled egg
omelette|300|omelette|omelet
egg white|17|white|egg whites
bacon|45|slice|bacon strip,strips of bacon
sausage link|90|link|sausage,breakfast sausage
toast|80|slice|bread,slice of bread,white bread,wheat bread
toast with butter|115|slice|buttered toast
bagel|280|bagel|plain bagel
bagel with cream cheese|380|bagel|
english muffin|135|muffin|
croissant|230|croissant|
muffin|420|muffin|blueberry muffin,chocolate muffin
donut|260|donut|doughnut,glazed donut
pancake|90|pancake|pancakes,hotcake
waffle|100|waffle|eggo,eggo waffle,waffles
french toast|230|slice|
syrup|100|2 tbsp|maple syrup,pancake syrup
cereal|150|bowl|cereal bowl,bowl of cereal,frosted flakes,cheerios,lucky charms
cereal with milk|230|bowl|
oatmeal|160|bowl|oats,porridge
granola|240|1/2 cup|
granola bar|120|bar|nature valley,chewy bar
protein bar|210|bar|clif bar,quest bar
yogurt|150|cup|greek yogurt,yoghurt,yogurt cup
yogurt parfait|280|cup|parfait
banana|105|banana|bananas
apple|95|apple|apples
orange|65|orange|oranges,clementine,cutie
grapes|60|cup|grape
strawberries|50|cup|strawberry
blueberries|85|cup|blueberry
watermelon|85|2 cups|
pineapple|80|cup|
mango|100|cup|
pear|100|pear|
peach|60|peach|
raisins|130|small box|
fruit cup|90|cup|fruit salad,mixed fruit
applesauce|90|cup|apple sauce
avocado|240|avocado|
guacamole|100|1/4 cup|guac
carrots|30|cup|carrot,baby carrots,carrot sticks
celery|10|stalks|
broccoli|55|cup|
salad|120|bowl|side salad,green salad
caesar salad|360|bowl|
chicken salad|400|bowl|
corn|130|ear|corn on the cob
green beans|40|cup|
peas|120|cup|
potato|160|potato|baked potato
mashed potatoes|230|cup|mashed potato
sweet potato|115|potato|
fries|365|medium|french fries,chips uk,fry
small fries|230|small|
large fries|490|large|
tater tots|200|serving|tots
hash browns|150|patty|hash brown
rice|205|cup|white rice
brown rice|215|cup|
fried rice|340|cup|
pasta|220|cup|noodles,spaghetti noodles
spaghetti|480|plate|spaghetti and meatballs,pasta with sauce
mac and cheese|350|cup|mac n cheese,macaroni,macaroni and cheese,kraft mac
lasagna|400|piece|
ramen|380|package|instant noodles,cup noodles,top ramen,cup of noodles
chicken breast|230|breast|grilled chicken,chicken
chicken nuggets|48|nugget|nuggets,mcnuggets,nugget
chicken tenders|120|tender|chicken strips,chicken strip,tenders
chicken wings|90|wing|wings,wing,hot wings,buffalo wings
fried chicken|320|piece|
rotisserie chicken|250|serving|
chicken sandwich|440|sandwich|chick fil a sandwich,spicy chicken sandwich
turkey sandwich|350|sandwich|
ham sandwich|350|sandwich|
grilled cheese|400|sandwich|grilled cheese sandwich
pb&j|380|sandwich|pbj,peanut butter and jelly,peanut butter jelly sandwich,pb and j
blt|450|sandwich|
sub|500|6 inch|subway,sub sandwich,hoagie
footlong|1000|footlong|footlong sub
wrap|450|wrap|chicken wrap
burger|550|burger|hamburger,cheeseburger
double cheeseburger|450|burger|
big mac|590|burger|
quarter pounder|520|burger|
whopper|670|burger|
hot dog|290|hot dog|hotdog,hot dogs
corn dog|240|corn dog|
pizza|285|slice|cheese pizza,slice of pizza,pizza slice
pepperoni pizza|315|slice|pepperoni
personal pizza|700|pizza|
taco|170|taco|tacos,hard taco
soft taco|200|taco|
burrito|700|burrito|chipotle burrito
burrito bowl|650|bowl|chipotle bowl,bowl
quesadilla|500|quesadilla|
nachos|550|plate|
chips and salsa|250|serving|
enchilada|320|enchilada|
steak|540|steak|ribeye,sirloin
pork chop|300|chop|
meatballs|70|meatball|meatball
salmon|370|fillet|grilled salmon
tuna|110|can|canned tuna
fish sticks|50|stick|fish stick
shrimp|7|shrimp|
sushi roll|300|roll|california roll,sushi
fried shrimp|340|serving|
soup|150|cup|chicken noodle soup,tomato soup
chili|300|cup|
stir fry|450|plate|
orange chicken|490|serving|panda express,panda orange chicken
dumplings|60|dumpling|potstickers,dumpling,gyoza
egg roll|200|egg roll|
curry|500|plate|
peanut butter|95|tbsp|pb
nutella|100|tbsp|
butter|100|tbsp|
cream cheese|50|tbsp|
mayo|90|tbsp|mayonnaise
ketchup|20|tbsp|
ranch|130|2 tbsp|ranch dressing
bbq sauce|60|2 tbsp|
salad dressing|120|2 tbsp|dressing
olive oil|120|tbsp|oil
cheese|110|slice|cheese slice,american cheese,cheddar
string cheese|80|stick|cheese stick
cottage cheese|180|cup|
hummus|70|2 tbsp|
milk|150|cup|glass of milk,whole milk
skim milk|85|cup|
chocolate milk|200|cup|
almond milk|40|cup|
oat milk|120|cup|
orange juice|110|cup|oj,juice
apple juice|115|cup|
juice box|90|box|capri sun
soda|150|can|coke,pepsi,sprite,dr pepper,coca cola,mountain dew,root beer,fanta
diet soda|0|can|diet coke,coke zero,pepsi zero,sprite zero
sports drink|140|bottle|gatorade,powerade
energy drink|110|can|red bull,monster,celsius
lemonade|120|cup|
sweet tea|90|cup|iced tea
coffee|5|cup|black coffee,americano
coffee with milk|40|cup|coffee with cream
latte|190|grande|
iced coffee|120|medium|
frappuccino|380|grande|frappe
hot chocolate|200|cup|hot cocoa
smoothie|300|medium|
milkshake|550|medium|shake
protein shake|160|shake|
water|0|glass|
beer|150|can|
wine|125|glass|
chips|150|1 oz bag|potato chips,lays,doritos,cheetos,bag of chips
popcorn|130|3 cups|
pretzels|110|oz|
crackers|130|serving|goldfish,cheez its,ritz
trail mix|170|1/4 cup|
almonds|165|1/4 cup|nuts
peanuts|165|1/4 cup|
cookie|150|cookie|cookies,chocolate chip cookie
oreo|53|cookie|oreos
brownie|230|brownie|
cupcake|300|cupcake|
cake|350|slice|birthday cake,piece of cake,chocolate cake
cheesecake|400|slice|
pie|320|slice|apple pie
ice cream|270|cup|
ice cream cone|250|cone|
ice cream sandwich|180|sandwich|
popsicle|60|pop|
candy bar|250|bar|snickers,kit kat,twix,hershey bar,chocolate bar,milky way
chocolate|150|oz|
gummy bears|140|serving|gummies,gummy worms
skittles|250|bag|m&ms,m and ms,starburst
jolly rancher|25|piece|
fruit snacks|80|pouch|gushers
pudding|110|cup|
jello|70|cup|jell-o
rice krispie treat|90|bar|rice krispies treat
pop tart|200|pastry|poptart,pop-tart,pop tarts
cinnamon roll|420|roll|
churro|240|churro|
pretzel|480|soft pretzel|soft pretzel
mcmuffin|310|sandwich|egg mcmuffin
breakfast burrito|400|burrito|
breakfast sandwich|450|sandwich|
chicken biscuit|450|biscuit|
biscuit|200|biscuit|
dinner roll|110|roll|roll,bread roll
garlic bread|200|slice|
tortilla|140|tortilla|
lunchable|350|pack|lunchables
salad bowl|550|bowl|sweetgreen
poke bowl|600|bowl|
pad thai|650|plate|
teriyaki chicken|450|plate|
mashed potato bowl|720|bowl|kfc bowl
fish and chips|800|plate|
clam chowder|240|cup|
bread stick|150|stick|breadstick,breadsticks
meal kit|600|meal|
frozen dinner|350|meal|lean cuisine,tv dinner
hot pocket|300|pocket|hot pockets
pizza rolls|40|roll|
mozzarella sticks|85|stick|mozzarella stick
onion rings|350|serving|
coleslaw|150|cup|
baked beans|240|cup|
refried beans|220|cup|
black beans|225|cup|beans
tofu|180|cup|
edamame|190|cup|
turkey|150|3 oz|turkey slices,deli turkey
ham|140|3 oz|deli ham
jerky|80|oz|beef jerky
`.trim().split('\n').map(line => {
  const [name, kcal, unit, aliases] = line.split('|');
  return { name, kcal: +kcal, unit, aliases: [name, ...(aliases || '').split(',').map(s => s.trim()).filter(Boolean)] };
});
