# BiteWise

Offline-first calorie counter with an Apple-style UI, for iPhone, iPad and Mac.

- **Quick log**: type a number on Today and press Enter. No food name needed.
- **Voice + text logging**: "two eggs and toast", "chipotle bowl 900". Parsed on the device with a built-in food list, so it works offline.
- **Bitey, the AI coach**: runs on Cloud Foundry's open models (`ai-models` service). It logs food, water and weight for you and suggests meals.
- **Health Score**: calories, steps, water, logging and streak, from 0 to 100.
- **Fitbit sync**: steps (and Aria weigh-ins) flow in. Steps can earn back calories.
- **Rewards**: XP, 10 levels, 14 badges, weekly challenges, streak freezes and unlockable themes.
- **Safety**: calorie floor of 1200/1500, pace capped at about 1% of body weight per week, teen mode under 18 (no calorie cut).

- **Food database**: 5,431 USDA foods with real serving sizes (offline), plus brand-name foods from Open Food Facts (online).
- **Allergies**: set them in Me; foods are tagged (peanut, tree nut, dairy, egg, gluten, soy, fish, shellfish, sesame) and you get warned.
- **Groups**: make a group, share the 6-letter code, see each other's goals, streaks and progress (each person picks what to share).
- **Recipes**: search recipes with ingredients, steps and YouTube videos.
- **Updates**: version number, update check and a What's new screen in the app. See CHANGELOG.md.

## Data sources and credits
- USDA FoodData Central, Survey (FNDDS) 2024-10-31: public domain (CC0). Rebuild with `node tools/build-usda.js surveyDownload.json`.
- Open Food Facts (openfoodfacts.org): open data under the ODbL. Brand search is credited in the app.
- TheMealDB (themealdb.com): free recipe API. Credited in the app.
- Allergen tags are typical ingredients, not a guarantee. Always check the label.

## Tests
    npm test          # parser, goal safety limits, version files, and the server API (accounts, sync, groups)

## Run locally
    npm install && npm start      # http://localhost:4970

## Deploy (Cloud Foundry)
    cf create-service postgres on-demand-postgres-db bitewise-db
    cf create-service ai-models tanzu-all-models bitewise-ai
    cf push

## Fitbit (one-time setup)
1. Register an app at https://dev.fitbit.com/apps/new. Pick "Personal" or "Server" type, and use the callback URL `https://<your-app-url>/api/fitbit/callback`.
2. Run `cf set-env bitewise FITBIT_CLIENT_ID <id>` and `cf set-env bitewise FITBIT_CLIENT_SECRET <secret>`, then `cf restage bitewise`.
