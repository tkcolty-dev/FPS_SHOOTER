// Costume design tools: a simple paint editor + a procedural "random creature" maker.
window.Paint = (function () {
  const SIZE = 400;
  let cv, ctx, tool = 'brush', color = '#7c4dff', brush = 12;
  let drawing = false, sx = 0, sy = 0, snapshot = null;
  const undoStack = [];

  const COLORS = ['#222222', '#ffffff', '#ff5c5c', '#ff9f43', '#ffd54f', '#59c059',
    '#00c4cc', '#4c97ff', '#7c4dff', '#ff5c8a', '#a0522d', '#9aa0b0'];

  function init() {
    cv = document.getElementById('paintCanvas');
    ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.lineCap = ctx.lineJoin = 'round';

    const colorRow = document.getElementById('paintColors');
    for (const c of COLORS) {
      const b = document.createElement('button');
      b.className = 'swatch'; b.style.background = c;
      if (c === color) b.classList.add('active');
      b.onclick = () => { color = c; colorRow.querySelectorAll('.swatch').forEach(x => x.classList.remove('active')); b.classList.add('active'); };
      colorRow.appendChild(b);
    }
    document.querySelectorAll('[data-tool]').forEach(b => {
      b.onclick = () => {
        tool = b.dataset.tool;
        document.querySelectorAll('[data-tool]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      };
    });
    document.getElementById('paintSize').oninput = e => brush = +e.target.value;
    document.getElementById('paintUndo').onclick = undo;
    document.getElementById('paintClear').onclick = () => { pushUndo(); ctx.clearRect(0, 0, SIZE, SIZE); };

    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function pos(e) {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * SIZE / r.width, (e.clientY - r.top) * SIZE / r.height];
  }
  function pushUndo() {
    undoStack.push(ctx.getImageData(0, 0, SIZE, SIZE));
    if (undoStack.length > 25) undoStack.shift();
  }
  function undo() { const im = undoStack.pop(); if (im) ctx.putImageData(im, 0, 0); }

  function down(e) {
    e.preventDefault();
    [sx, sy] = pos(e);
    pushUndo();
    if (tool === 'fill') { floodFill(Math.round(sx), Math.round(sy)); return; }
    drawing = true;
    snapshot = ctx.getImageData(0, 0, SIZE, SIZE);
    if (tool === 'brush' || tool === 'eraser') dot(sx, sy);
  }
  function move(e) {
    if (!drawing) return;
    const [x, y] = pos(e);
    if (tool === 'brush' || tool === 'eraser') {
      stroke(sx, sy, x, y);
      [sx, sy] = [x, y];
    } else {
      ctx.putImageData(snapshot, 0, 0);
      shape(sx, sy, x, y);
    }
  }
  function up() { drawing = false; }

  function setPen(erase) {
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.lineWidth = brush;
  }
  function dot(x, y) { setPen(tool === 'eraser'); ctx.beginPath(); ctx.arc(x, y, brush / 2, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
  function stroke(x0, y0, x1, y1) { setPen(tool === 'eraser'); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
  function shape(x0, y0, x1, y1) {
    setPen(false);
    ctx.beginPath();
    if (tool === 'line') { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    else if (tool === 'rect') { ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); }
    else if (tool === 'ellipse') { ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, 7); ctx.fill(); }
  }

  function floodFill(x, y) {
    const img = ctx.getImageData(0, 0, SIZE, SIZE), d = img.data;
    const idx = (x, y) => (y * SIZE + x) * 4;
    const t = idx(x, y);
    const target = [d[t], d[t + 1], d[t + 2], d[t + 3]];
    const m = /^#(..)(..)(..)$/.exec(color);
    const fill = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 255];
    if (target.every((v, i) => v === fill[i])) return;
    const match = i => d[i] === target[0] && d[i + 1] === target[1] && d[i + 2] === target[2] && d[i + 3] === target[3];
    const stack = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop();
      if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) continue;
      const i = idx(px, py);
      if (!match(i)) continue;
      d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; d[i + 3] = fill[3];
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    ctx.putImageData(img, 0, 0);
  }

  async function saveAsCostume() {
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    const resp = await fetch('/upload?name=painted.png', { method: 'POST', body: blob }).then(r => r.json());
    return { md5ext: resp.md5ext, url: resp.url, dataFormat: 'png', width: SIZE, height: SIZE, cx: SIZE / 2, cy: SIZE / 2 };
  }

  // ---------- procedural creature ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.round(rnd(a, b));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function randomCreatureSVG() {
    const hues = [265, 330, 200, 150, 20, 45, 180, 090];
    const h = pick(hues);
    const body = `hsl(${h},70%,60%)`, belly = `hsl(${h},70%,80%)`, dark = `hsl(${h},70%,35%)`;
    const acc = `hsl(${(h + 160) % 360},80%,60%)`;
    const rx = ri(38, 48), ry = ri(34, 48);
    const parts = [];
    // feet
    const feet = ri(0, 2);
    for (let i = 0; i < feet; i++) {
      const fx = 60 + (i === 0 ? -ri(14, 22) : ri(14, 22));
      parts.push(`<ellipse cx="${fx}" cy="${ri(104, 110)}" rx="10" ry="7" fill="${dark}"/>`);
    }
    // antennae / horns / ears
    const topper = pick(['antennae', 'horns', 'ears', 'none']);
    if (topper === 'antennae') {
      parts.push(`<path d="M${60 - ri(16, 24)} ${ri(18, 26)} L${60 - ri(8, 14)} ${70 - ry + 6}" stroke="${body}" stroke-width="5" stroke-linecap="round"/>`);
      parts.push(`<path d="M${60 + ri(16, 24)} ${ri(18, 26)} L${60 + ri(8, 14)} ${70 - ry + 6}" stroke="${body}" stroke-width="5" stroke-linecap="round"/>`);
      parts.push(`<circle cx="${60 - ri(16, 24)}" cy="${ri(16, 24)}" r="6" fill="${acc}"/>`);
      parts.push(`<circle cx="${60 + ri(16, 24)}" cy="${ri(16, 24)}" r="6" fill="${acc}"/>`);
    } else if (topper === 'horns') {
      parts.push(`<path d="M${60 - ri(20, 28)} ${70 - ry + 10} L${60 - ri(26, 34)} ${ri(16, 24)} L${60 - ri(10, 16)} ${70 - ry + 4} Z" fill="${acc}"/>`);
      parts.push(`<path d="M${60 + ri(20, 28)} ${70 - ry + 10} L${60 + ri(26, 34)} ${ri(16, 24)} L${60 + ri(10, 16)} ${70 - ry + 4} Z" fill="${acc}"/>`);
    } else if (topper === 'ears') {
      parts.push(`<circle cx="${60 - ri(22, 30)}" cy="${70 - ry + ri(2, 8)}" r="${ri(9, 13)}" fill="${body}"/>`);
      parts.push(`<circle cx="${60 + ri(22, 30)}" cy="${70 - ry + ri(2, 8)}" r="${ri(9, 13)}" fill="${body}"/>`);
    }
    // body + belly
    parts.push(`<ellipse cx="60" cy="70" rx="${rx}" ry="${ry}" fill="${body}"/>`);
    if (Math.random() < 0.8) parts.push(`<ellipse cx="60" cy="${70 + ri(2, 10)}" rx="${Math.round(rx * 0.65)}" ry="${Math.round(ry * 0.6)}" fill="${belly}"/>`);
    // spots
    if (Math.random() < 0.4) for (let i = 0; i < ri(2, 4); i++)
      parts.push(`<circle cx="${ri(30, 90)}" cy="${ri(50, 90)}" r="${ri(3, 6)}" fill="${dark}" opacity="0.5"/>`);
    // eyes
    const eyes = pick([1, 2, 2, 2, 3]);
    const eyeY = ri(48, 58), er = ri(9, 13);
    const exs = eyes === 1 ? [60] : eyes === 2 ? [60 - ri(14, 18), 60 + ri(14, 18)] : [60 - 20, 60, 60 + 20];
    for (const ex of exs) {
      parts.push(`<circle cx="${ex}" cy="${eyeY}" r="${er}" fill="#fff"/>`);
      parts.push(`<circle cx="${ex + ri(-2, 2)}" cy="${eyeY + 2}" r="${Math.round(er * 0.45)}" fill="#222"/>`);
    }
    // mouth
    const mouth = pick(['smile', 'open', 'wavy']);
    const my = eyeY + ri(18, 26);
    if (mouth === 'smile') parts.push(`<path d="M${60 - ri(10, 16)} ${my} Q60 ${my + ri(8, 14)} ${60 + ri(10, 16)} ${my}" stroke="${dark}" stroke-width="4" fill="none" stroke-linecap="round"/>`);
    else if (mouth === 'open') parts.push(`<ellipse cx="60" cy="${my + 2}" rx="${ri(7, 11)}" ry="${ri(5, 9)}" fill="${dark}"/>`);
    else parts.push(`<path d="M${60 - 14} ${my} q7 6 14 0 q7 -6 14 0" stroke="${dark}" stroke-width="4" fill="none" stroke-linecap="round"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">${parts.join('')}</svg>`;
  }

  async function uploadRandomCreature() {
    const svg = randomCreatureSVG();
    const resp = await fetch('/upload?name=creature.svg', { method: 'POST', body: new Blob([svg], { type: 'image/svg+xml' }) }).then(r => r.json());
    return { md5ext: resp.md5ext, url: resp.url, dataFormat: 'svg', width: 120, height: 120, cx: 60, cy: 60 };
  }

  return { init, saveAsCostume, uploadRandomCreature };
})();
