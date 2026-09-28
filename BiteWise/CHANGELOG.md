# BiteWise change log

Every release is tagged in git (`v1.4.0`, `v1.3.0`, …), so any version can be brought back.
The app shows this same list under **Me → Version → What's new**. Edit `public/version.json`, not this file.

## Going back to an earlier version

```sh
git tag                          # list versions
git checkout v1.3.0              # look at an old version (read-only)
cf push                          # optional: run that old version live
git checkout main                # return to the newest code
```

To undo one release but keep everything after it: `git revert <commit>` (see `git log v1.3.0..v1.4.0` for a release's commits).

## Releasing a new version

1. Bump `version` and add an entry at the top of `history` in `public/version.json`.
2. Set `APP_VERSION` in `public/app.js` to the same number, and bump `VERSION` in `public/sw.js`.
3. `npm test`. Everything must pass.
4. `node tools/changelog.js`, then commit, tag (`git tag v1.x.y`), push, and deploy with `cf push --strategy rolling` (no downtime).

## 1.7.0 · Smarter Bitey, offline Bitey, logging for friends
_2026-09-28 · git tag `v1.7.0`_

- New: Bitey can look things up, like 'what is Holtman's Donuts', using Wikipedia, DuckDuckGo and OpenStreetMap. Lookups are safe, food and fitness only, and show their sources.
- New: Bitey answers with cards: meal ideas with photos, ingredients, calories that add up, steps and a Log this button. Places come with an address, hours, Maps and Website.
- New: Offline Bitey. With no internet it still logs food, steps, water, weight and goals, and looks up calories. Other questions are answered automatically when you're back online.
- New: People in your group can log food for you (you can turn this off in What I share). It shows who added it, and it arrives even if you were offline.
- New: Anything you do offline that needs the internet is saved and sent when you reconnect.
- New: 12 free colors, plus Light, Dark or Automatic appearance (Me → Look).

## 1.6.0 · Bitey can do more
_2026-09-27 · git tag `v1.6.0`_

- New: Tell Bitey your steps. 'I walked 6,000 steps' sets them, and 'I walked 2,000 more' adds them.
- New: Ask Bitey to change your daily goal, like 'make my goal 1,800'. The safety minimum still applies.
- New: Ask Bitey to remove something you logged, like 'take off the chips'.
- New: Log for yesterday, like 'I forgot to log a burrito yesterday'.
- Changed: Everything Bitey changes shows in a card with an Undo button.

## 1.5.3 · No more 503 on reload
_2026-09-27 · git tag `v1.5.3`_

- Fixed: Reloading during an update or server restart no longer shows a 503 error. The app uses its saved copy instead.
- Changed: BiteWise now runs two copies on the server and updates without downtime.

## 1.5.2 · New This week card
_2026-09-27 · git tag `v1.5.2`_

- Changed: 'This week' shows a ring for each day plus your average, days on track, streak and weight trend, instead of tall bars that stretched on big screens.

## 1.5.1 · Bitey stays on topic
_2026-09-27 · git tag `v1.5.1`_

- Fixed: Bitey sticks to food, fitness and BiteWise. For other things, like chess or homework, it politely steers back.
- Fixed: Web links in Bitey's replies can be tapped.

## 1.5.0 · A fuller Today page
_2026-09-27 · git tag `v1.5.0`_

- New: Today is laid out as a grid of cards that fills the screen on iPhone, iPad and Mac.
- New: Calories card shows how much you ate at breakfast, lunch, dinner and snacks. Tap one to add to it.
- New: 'Fits your day' suggests three foods that fit what you have left. One tap logs it, and it skips your allergies.
- New: Search button next to the calorie box.
- New: Steps card shows your last 7 days on iPad and Mac, plus calories earned from steps.

## 1.4.2 · Same goal rules for everyone
_2026-09-27 · git tag `v1.4.2`_

- Changed: No separate under-18 rules. Everyone can pick any pace up to about 1% of body weight a week, or set their own number.
- Changed: The lowest goal is 1,200 calories (1,500 for male) for everyone.

## 1.4.1 · Setting your own number
_2026-09-27 · git tag `v1.4.1`_

- Fixed: 'Set my own number' no longer quietly ignores numbers below your minimum. It tells you the lowest you can set and why.
- Fixed: Me and Today always show the goal that's actually being used.
- Changed: The − button stops at your minimum.

## 1.4.0 · Groups, 5,000+ foods and allergies
_2026-09-27 · git tag `v1.4.0`_

- New: Groups. Make a group, send the 6-letter code, and see each other's goals, streaks and progress. You choose what you share.
- New: 5,431 foods from the USDA database, with real serving sizes. They work offline.
- New: Search brand-name foods online (Open Food Facts).
- New: Recipes with ingredients, steps and YouTube videos.
- New: Allergies. Set yours in Me and BiteWise warns you when a food has them. Bitey won't suggest them either.
- New: Food suggestions while you type on the home screen.
- New: A 'This week' card on the home screen.
- New: Version number, update check, and this What's new screen.
- Fixed: The coach message box now clears after you send.

## 1.3.0 · Easy goals and your account everywhere
_2026-09-27 · git tag `v1.3.0`_

- New: Goal screen with Lose / Maintain / Gain, how fast, or set your own calorie number.
- New: 'I already have an account' on the first screen, and a 'Save your progress' step.
- New: Stay signed in until you choose Sign out.
- Fixed: Signing in on a new device no longer overwrites your cloud goals.
- Fixed: Page margins after signing in on a second device.

## 1.2.0 · Smoother logging
_2026-09-27 · git tag `v1.2.0`_

- New: Log sheet with one row of modes, four meal tiles and a thumb-height keypad.
- New: Type numbers with a Mac or iPad keyboard.
- New: Bigger edit screen, meal icons, and foods slide in and fold away.
- Fixed: Pop-up messages no longer cover buttons.

## 1.1.0 · Calmer home screen
_2026-09-27 · git tag `v1.1.0`_

- New: Home shows just calories eaten and steps, with quick log right there.
- New: Screens update smoothly instead of redrawing.
- New: Fitbit sync through Google Health.
- Changed: 'Sex' is now 'Gender' with an Other option.

## 1.0.0 · First release
_2026-09-27 · git tag `v1.0.0`_

- Quick log, voice and text logging that work offline.
- Bitey, the AI coach, on Cloud Foundry open models.
- Health Score, levels, badges, streaks and themes.
- Works on iPhone, iPad and Mac, and installs to the home screen.
