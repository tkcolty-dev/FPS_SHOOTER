// Title screen background: uses assets/title_bg.png if the artist made one,
// otherwise draws the animated castle-sunset placeholder.

let canvas, ctx;
const bg = new Image();
let bgOk = false;
bg.onload = () => { bgOk = true; };
bg.src = 'assets/title_bg.png';

export function drawTitleBg(now) {
  if (!canvas) {
    canvas = document.getElementById('title-bg');
    ctx = canvas.getContext('2d');
  }
  const c = canvas, x = ctx;
  if (c.width !== innerWidth) { c.width = innerWidth; c.height = innerHeight; }

  if (bgOk) { x.drawImage(bg, 0, 0, c.width, c.height); return; }

  const g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#1c1430');
  g.addColorStop(0.55, '#4a2438');
  g.addColorStop(0.8, '#8a4a30');
  g.addColorStop(1, '#c9852f');
  x.fillStyle = g;
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = 'rgba(255,214,140,0.9)';
  x.beginPath(); x.arc(c.width * 0.72, c.height * 0.72, 60, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 5; i++) {
    const cx = ((now / (14000 + i * 3000)) * c.width + i * c.width * 0.25) % (c.width + 300) - 150;
    const cy = c.height * (0.12 + i * 0.09);
    x.beginPath(); x.ellipse(cx, cy, 120 + i * 25, 26, 0, 0, 7); x.fill();
  }
  x.fillStyle = '#120c08';
  const base = c.height * 0.86;
  x.fillRect(0, base, c.width, c.height - base);
  const mid = c.width / 2;
  const tower = (tx, tw, th) => {
    x.fillRect(tx - tw / 2, base - th, tw, th);
    const n = 4, cw = tw / (n * 2 - 1);
    for (let i = 0; i < n; i++) x.fillRect(tx - tw / 2 + i * cw * 2, base - th - cw, cw, cw);
  };
  tower(mid - 260, 70, 150); tower(mid - 140, 50, 100);
  x.fillRect(mid - 260, base - 80, 520, 80);
  tower(mid + 140, 50, 100); tower(mid + 260, 70, 150);
  tower(mid, 90, 200);
  x.strokeStyle = '#120c08'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(mid, base - 200); x.lineTo(mid, base - 240); x.stroke();
  x.fillStyle = '#d8a83f';
  const flap = Math.sin(now / 300) * 6;
  x.beginPath(); x.moveTo(mid, base - 240); x.lineTo(mid + 34, base - 232 + flap); x.lineTo(mid, base - 224); x.closePath(); x.fill();
}
