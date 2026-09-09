/* Standalone game player — used by exported .html games.
   Expects window.BW_GAME = { project, scripts } (scripts = compiled code per object id). */
import { Engine } from './engine.js';
const game = window.BW_GAME;
const canvas = document.getElementById('view'), hud = document.getElementById('hud');
const engine = new Engine({ canvas, hud, editor: false });
engine.grid.visible = false;
const GenFn = Object.getPrototypeOf(function*(){}).constructor;
const byId = {};
for (const k in game.scripts) byId[k] = game.scripts[k].map(s => Object.assign({}, s, { fn: new GenFn('self', 'R', 'V', '_thread', '_arg', 'L', s.code) }));
const errEl = document.getElementById('err');
engine.onError = m => { if (errEl){ errEl.textContent = m; errEl.style.display = 'block'; } };
(async () => {
  await engine.loadProject(game.project);
  const start = document.getElementById('start');
  const go = () => { start.style.display = 'none'; engine.play(byId); canvas.focus(); };
  start.addEventListener('click', go);
  document.getElementById('restart').addEventListener('click', () => { engine.stop(); engine.play(byId); canvas.focus(); });
})();
