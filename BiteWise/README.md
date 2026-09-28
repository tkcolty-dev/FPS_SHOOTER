# BiteWise

Offline-first calorie counter with an Apple-style UI, for iPhone, iPad and Mac.

- **Quick log**: type a number on Today and press Enter. No food name needed.
- **Voice + text logging**: "two eggs and toast", "chipotle bowl 900". Parsed on the device with a built-in food list, so it works offline.
- **Bitey, the AI coach**: runs on Cloud Foundry's open models (`ai-models` service). It logs food, water and weight for you and suggests meals.
- **Health Score**: calories, steps, water, logging and streak, from 0 to 100.
- **Fitbit sync**: steps (and Aria weigh-ins) flow in. Steps can earn back calories.
- **Rewards**: XP, 10 levels, 14 badges, weekly challenges, streak freezes and unlockable themes.
- **Safety**: calorie floor of 1200/1500, pace capped at about 1% of body weight per week, teen mode under 18 (no calorie cut).

## Run locally
    npm install && npm start      # http://localhost:4970

## Deploy (Cloud Foundry)
    cf create-service postgres on-demand-postgres-db bitewise-db
    cf create-service ai-models tanzu-all-models bitewise-ai
    cf push

## Fitbit (one-time setup)
1. Register an app at https://dev.fitbit.com/apps/new. Pick "Personal" or "Server" type, and use the callback URL `https://<your-app-url>/api/fitbit/callback`.
2. Run `cf set-env bitewise FITBIT_CLIENT_ID <id>` and `cf set-env bitewise FITBIT_CLIENT_SECRET <secret>`, then `cf restage bitewise`.
