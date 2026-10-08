/* Spark Engine — built-in library: costumes (SVG), backdrops, synth sounds */
(function () {
  const svgWrap = (w, h, inner) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;

  const shade = (hex, amt) => {
    const n = parseInt(hex.replace('#', ''), 16);
    const f = c => Math.max(0, Math.min(255, c + amt)).toString(16).padStart(2, '0');
    return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
  };

  /* ---------- Costume shapes. Each: (color) -> svg string ---------- */
  const COSTUMES = {
    'Hero': { w: 64, h: 80, svg: c => svgWrap(64, 80,
      `<rect x="18" y="30" width="28" height="30" rx="8" fill="${c}"/>
       <circle cx="32" cy="18" r="15" fill="#ffd9b3"/>
       <path d="M17 14 Q32 -4 47 14 Z" fill="${shade(c,-40)}"/>
       <circle cx="26" cy="18" r="2.5" fill="#222"/><circle cx="38" cy="18" r="2.5" fill="#222"/>
       <path d="M27 25 Q32 29 37 25" stroke="#222" stroke-width="2" fill="none"/>
       <rect x="14" y="34" width="8" height="24" rx="4" fill="#ffd9b3"/><rect x="42" y="34" width="8" height="24" rx="4" fill="#ffd9b3"/>
       <rect x="20" y="58" width="10" height="20" rx="4" fill="#334"/><rect x="34" y="58" width="10" height="20" rx="4" fill="#334"/>`) },
    'Cat': { w: 80, h: 70, svg: c => svgWrap(80, 70,
      `<ellipse cx="40" cy="48" rx="26" ry="20" fill="${c}"/>
       <circle cx="40" cy="26" r="20" fill="${c}"/>
       <path d="M24 14 L20 -2 L34 10 Z" fill="${c}"/><path d="M56 14 L60 -2 L46 10 Z" fill="${c}"/>
       <path d="M26 12 L24 4 L32 11 Z" fill="#ffb3c6"/><path d="M54 12 L56 4 L48 11 Z" fill="#ffb3c6"/>
       <circle cx="33" cy="24" r="4" fill="#fff"/><circle cx="47" cy="24" r="4" fill="#fff"/>
       <circle cx="34" cy="25" r="2" fill="#222"/><circle cx="46" cy="25" r="2" fill="#222"/>
       <path d="M37 31 L43 31 L40 34 Z" fill="#ffb3c6"/>
       <path d="M30 36 Q40 42 50 36" stroke="#222" stroke-width="1.5" fill="none"/>
       <path d="M62 50 Q80 40 72 62" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`) },
    'Robot': { w: 64, h: 80, svg: c => svgWrap(64, 80,
      `<rect x="14" y="26" width="36" height="34" rx="6" fill="${c}"/>
       <rect x="18" y="6" width="28" height="22" rx="5" fill="${shade(c,30)}"/>
       <rect x="22" y="12" width="8" height="8" fill="#9ff"/><rect x="34" y="12" width="8" height="8" fill="#9ff"/>
       <rect x="30" y="0" width="4" height="7" fill="#999"/><circle cx="32" cy="0" r="3" fill="#f44"/>
       <rect x="6" y="30" width="8" height="22" rx="3" fill="#888"/><rect x="50" y="30" width="8" height="22" rx="3" fill="#888"/>
       <rect x="18" y="60" width="10" height="18" fill="#666"/><rect x="36" y="60" width="10" height="18" fill="#666"/>
       <rect x="24" y="34" width="16" height="4" fill="#222"/><circle cx="26" cy="48" r="3" fill="#ff5"/><circle cx="38" cy="48" r="3" fill="#5f5"/>`) },
    'Alien': { w: 64, h: 72, svg: c => svgWrap(64, 72,
      `<ellipse cx="32" cy="48" rx="20" ry="22" fill="${c}"/>
       <ellipse cx="32" cy="22" rx="22" ry="18" fill="${shade(c,20)}"/>
       <ellipse cx="24" cy="22" rx="6" ry="8" fill="#111"/><ellipse cx="40" cy="22" rx="6" ry="8" fill="#111"/>
       <circle cx="25" cy="20" r="2" fill="#fff"/><circle cx="41" cy="20" r="2" fill="#fff"/>
       <path d="M20 4 Q14 -4 10 2" stroke="${c}" stroke-width="3" fill="none"/><path d="M44 4 Q50 -4 54 2" stroke="${c}" stroke-width="3" fill="none"/>
       <circle cx="10" cy="2" r="3" fill="#ff5"/><circle cx="54" cy="2" r="3" fill="#ff5"/>`) },
    'Ghost': { w: 60, h: 72, svg: c => svgWrap(60, 72,
      `<path d="M8 40 Q8 4 30 4 Q52 4 52 40 L52 68 L44 60 L36 68 L30 60 L24 68 L16 60 L8 68 Z" fill="${c}"/>
       <circle cx="22" cy="28" r="5" fill="#222"/><circle cx="38" cy="28" r="5" fill="#222"/>
       <ellipse cx="30" cy="42" rx="4" ry="6" fill="#222"/>`) },
    'Slime': { w: 64, h: 48, svg: c => svgWrap(64, 48,
      `<path d="M4 44 Q2 8 32 6 Q62 8 60 44 Z" fill="${c}"/>
       <ellipse cx="20" cy="20" rx="6" ry="4" fill="#fff" opacity=".6"/>
       <circle cx="24" cy="28" r="4" fill="#222"/><circle cx="42" cy="28" r="4" fill="#222"/>
       <path d="M28 36 Q33 40 38 36" stroke="#222" stroke-width="2" fill="none"/>`) },
    'Ball': { w: 50, h: 50, svg: c => svgWrap(50, 50,
      `<circle cx="25" cy="25" r="24" fill="${c}"/><circle cx="18" cy="17" r="7" fill="#fff" opacity=".5"/>`) },
    'Square': { w: 50, h: 50, svg: c => svgWrap(50, 50, `<rect x="1" y="1" width="48" height="48" rx="6" fill="${c}"/>`) },
    'Triangle': { w: 56, h: 50, svg: c => svgWrap(56, 50, `<path d="M28 2 L54 48 L2 48 Z" fill="${c}"/>`) },
    'Star': { w: 56, h: 56, svg: c => svgWrap(56, 56,
      `<path d="M28 2 L35 20 L54 21 L39 33 L44 52 L28 41 L12 52 L17 33 L2 21 L21 20 Z" fill="${c}"/>`) },
    'Heart': { w: 56, h: 52, svg: c => svgWrap(56, 52,
      `<path d="M28 50 L6 28 Q-4 14 10 6 Q22 0 28 12 Q34 0 46 6 Q60 14 50 28 Z" fill="${c}"/>`) },
    'Arrow': { w: 60, h: 40, svg: c => svgWrap(60, 40, `<path d="M2 14 L34 14 L34 2 L58 20 L34 38 L34 26 L2 26 Z" fill="${c}"/>`) },
    'Coin': { w: 40, h: 40, svg: c => svgWrap(40, 40,
      `<circle cx="20" cy="20" r="19" fill="#f5c400"/><circle cx="20" cy="20" r="14" fill="#ffe36b"/>
       <text x="20" y="27" font-size="18" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#c99700">$</text>`) },
    'Gem': { w: 44, h: 44, svg: c => svgWrap(44, 44,
      `<path d="M10 4 L34 4 L42 16 L22 42 L2 16 Z" fill="${c}"/><path d="M10 4 L22 16 L34 4 Z" fill="#fff" opacity=".4"/>
       <path d="M2 16 L22 16 L22 42 Z" fill="#000" opacity=".15"/>`) },
    'Key': { w: 56, h: 28, svg: c => svgWrap(56, 28,
      `<circle cx="14" cy="14" r="12" fill="${c}"/><circle cx="14" cy="14" r="5" fill="#fff"/>
       <rect x="24" y="11" width="30" height="6" fill="${c}"/><rect x="44" y="17" width="5" height="8" fill="${c}"/><rect x="34" y="17" width="5" height="6" fill="${c}"/>`) },
    'Bullet': { w: 24, h: 10, svg: c => svgWrap(24, 10, `<rect x="0" y="1" width="20" height="8" rx="4" fill="${c}"/><circle cx="20" cy="5" r="4" fill="#fff" opacity=".7"/>`) },
    'Laser': { w: 40, h: 8, svg: c => svgWrap(40, 8, `<rect x="0" y="0" width="40" height="8" rx="4" fill="${c}"/><rect x="4" y="2" width="32" height="2" fill="#fff" opacity=".8"/>`) },
    'Rocket': { w: 40, h: 80, svg: c => svgWrap(40, 80,
      `<path d="M20 0 Q38 24 34 60 L6 60 Q2 24 20 0 Z" fill="${c}"/>
       <path d="M6 44 L-2 70 L8 62 Z" fill="${shade(c,-50)}"/><path d="M34 44 L42 70 L32 62 Z" fill="${shade(c,-50)}"/>
       <circle cx="20" cy="28" r="7" fill="#9ff" stroke="#fff" stroke-width="2"/>
       <path d="M12 60 L20 80 L28 60 Z" fill="#ffa"/><path d="M15 60 L20 72 L25 60 Z" fill="#f90"/>`) },
    'Spaceship': { w: 64, h: 56, svg: c => svgWrap(64, 56,
      `<path d="M32 2 L58 50 L32 40 L6 50 Z" fill="${c}"/><circle cx="32" cy="24" r="6" fill="#9ff"/>
       <path d="M26 44 L32 56 L38 44 Z" fill="#f90"/>`) },
    'Car': { w: 90, h: 44, svg: c => svgWrap(90, 44,
      `<path d="M4 30 L8 16 L30 14 L42 4 L70 4 L82 16 L88 20 L88 32 L4 32 Z" fill="${c}"/>
       <path d="M34 14 L44 6 L62 6 L64 14 Z" fill="#bff"/>
       <circle cx="22" cy="34" r="8" fill="#222"/><circle cx="68" cy="34" r="8" fill="#222"/>
       <circle cx="22" cy="34" r="3" fill="#aaa"/><circle cx="68" cy="34" r="3" fill="#aaa"/>`) },
    'Platform': { w: 120, h: 24, svg: c => svgWrap(120, 24,
      `<rect x="0" y="0" width="120" height="24" rx="4" fill="${c}"/>
       <rect x="0" y="0" width="120" height="6" rx="3" fill="#fff" opacity=".35"/>
       <path d="M0 12 H120 M30 12 V24 M70 12 V24 M110 12 V24 M10 0 V12 M50 0 V12 M90 0 V12" stroke="#000" stroke-opacity=".2" stroke-width="2"/>`) },
    'Grass Block': { w: 48, h: 48, svg: c => svgWrap(48, 48,
      `<rect x="0" y="0" width="48" height="48" fill="#8b5a2b"/><rect x="0" y="0" width="48" height="14" fill="#5cb83a"/>
       <path d="M6 14 V20 M16 14 V18 M26 14 V22 M36 14 V18" stroke="#5cb83a" stroke-width="4"/>
       <rect x="8" y="24" width="8" height="6" fill="#6b421a"/><rect x="28" y="34" width="10" height="6" fill="#6b421a"/>`) },
    'Brick': { w: 48, h: 48, svg: c => svgWrap(48, 48,
      `<rect width="48" height="48" fill="#c0564a"/>
       <path d="M0 16 H48 M0 32 H48 M24 0 V16 M12 16 V32 M36 16 V32 M24 32 V48" stroke="#8e3a30" stroke-width="3"/>`) },
    'Spike': { w: 48, h: 32, svg: c => svgWrap(48, 32, `<path d="M0 32 L12 2 L24 32 L36 2 L48 32 Z" fill="${c}"/>`) },
    'Cloud': { w: 90, h: 50, svg: c => svgWrap(90, 50,
      `<circle cx="28" cy="30" r="18" fill="${c}"/><circle cx="50" cy="22" r="22" fill="${c}"/><circle cx="70" cy="32" r="16" fill="${c}"/>
       <rect x="20" y="30" width="56" height="18" rx="9" fill="${c}"/>`) },
    'Tree': { w: 70, h: 100, svg: c => svgWrap(70, 100,
      `<rect x="29" y="60" width="12" height="40" fill="#7a4a1e"/>
       <circle cx="35" cy="40" r="28" fill="${c}"/><circle cx="18" cy="56" r="16" fill="${c}"/><circle cx="52" cy="56" r="16" fill="${c}"/>`) },
    'Flag': { w: 44, h: 72, svg: c => svgWrap(44, 72,
      `<rect x="4" y="0" width="5" height="72" fill="#555"/><path d="M9 4 L42 14 L9 26 Z" fill="${c}"/>`) },
    'Door': { w: 44, h: 72, svg: c => svgWrap(44, 72,
      `<rect x="0" y="0" width="44" height="72" rx="4" fill="${shade(c,-60)}"/><rect x="5" y="5" width="34" height="67" rx="3" fill="${c}"/>
       <circle cx="32" cy="40" r="3" fill="#ffd700"/>`) },
    'Paddle': { w: 20, h: 90, svg: c => svgWrap(20, 90, `<rect x="0" y="0" width="20" height="90" rx="8" fill="${c}"/>`) },
    'Apple': { w: 44, h: 48, svg: c => svgWrap(44, 48,
      `<path d="M22 12 Q4 6 4 28 Q4 46 18 46 Q22 44 26 46 Q40 46 40 28 Q40 6 22 12 Z" fill="${c}"/>
       <rect x="20" y="2" width="4" height="12" fill="#6b3"/><ellipse cx="29" cy="7" rx="7" ry="3" fill="#5a3" transform="rotate(-30 29 7)"/>`) },
    'Bomb': { w: 48, h: 56, svg: c => svgWrap(48, 56,
      `<circle cx="22" cy="34" r="20" fill="#333"/><rect x="18" y="10" width="8" height="8" fill="#666"/>
       <path d="M22 10 Q30 0 40 6" stroke="#a86" stroke-width="3" fill="none"/><circle cx="40" cy="5" r="4" fill="#fc3"/>
       <circle cx="15" cy="27" r="5" fill="#fff" opacity=".25"/>`) },
    'Crate': { w: 48, h: 48, svg: c => svgWrap(48, 48,
      `<rect width="48" height="48" fill="#c89550"/><rect x="4" y="4" width="40" height="40" fill="none" stroke="#8a5a20" stroke-width="4"/>
       <path d="M4 4 L44 44 M44 4 L4 44" stroke="#8a5a20" stroke-width="4"/>`) },
    'Fish': { w: 64, h: 40, svg: c => svgWrap(64, 40,
      `<ellipse cx="28" cy="20" rx="24" ry="14" fill="${c}"/><path d="M50 20 L64 6 L64 34 Z" fill="${c}"/>
       <circle cx="16" cy="16" r="3" fill="#fff"/><circle cx="16" cy="16" r="1.5" fill="#000"/>`) },
    'Bird': { w: 56, h: 44, svg: c => svgWrap(56, 44,
      `<ellipse cx="26" cy="26" rx="20" ry="14" fill="${c}"/><circle cx="40" cy="16" r="10" fill="${c}"/>
       <path d="M48 16 L58 19 L48 22 Z" fill="#f90"/><circle cx="42" cy="14" r="2" fill="#000"/>
       <path d="M14 22 Q24 8 36 22 Z" fill="${shade(c,-40)}"/>`) },
    'Dragon': { w: 90, h: 70, svg: c => svgWrap(90, 70,
      `<ellipse cx="44" cy="44" rx="30" ry="18" fill="${c}"/><circle cx="72" cy="30" r="14" fill="${c}"/>
       <path d="M80 26 L90 30 L80 34 Z" fill="${shade(c,-40)}"/><circle cx="74" cy="26" r="3" fill="#ff0"/>
       <path d="M30 32 Q20 2 50 20 Z" fill="${shade(c,-50)}"/><path d="M10 44 L0 60 L14 54 Z" fill="${c}"/>
       <path d="M62 14 L66 4 L70 16 Z" fill="#fff"/>`) },
    'Text Label': { w: 120, h: 40, svg: c => svgWrap(120, 40,
      `<text x="60" y="28" font-size="24" font-family="Arial" font-weight="bold" text-anchor="middle" fill="${c}">Hello</text>`) },
    'Button': { w: 120, h: 44, svg: c => svgWrap(120, 44,
      `<rect x="1" y="1" width="118" height="42" rx="12" fill="${c}" stroke="${shade(c,-60)}" stroke-width="2"/>
       <text x="60" y="29" font-size="20" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#fff">PLAY</text>`) }
  };

  const COLORS = ['#4C97FF', '#FF6680', '#59C059', '#FFBF00', '#9966FF', '#FF8C1A', '#5CB1D6', '#E64980', '#0FBD8C', '#ffffff', '#333333', '#8b5a2b'];

  function emojiSVG(emoji, size = 72) {
    return svgWrap(size, size, `<text x="${size / 2}" y="${size * 0.78}" font-size="${size * 0.8}" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${emoji}</text>`);
  }
  const FONTS = { Sans: 'Helvetica, Arial, sans-serif', Serif: 'Georgia, serif', Mono: 'Menlo, monospace', Handwriting: '"Comic Sans MS", "Chalkboard SE", cursive', Pixel: '"Courier New", monospace' };
  function textSVG(text, size = 24, color = '#333', font = 'Sans') {
    const lines = String(text).split('\n');
    const w = Math.max(10, ...lines.map(l => l.length)) * size * 0.62 + 12;
    const h = lines.length * size * 1.25 + 8;
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const rows = lines.map((l, i) => `<text x="${w / 2}" y="${size * (i + 1) * 1.1 + 2}" font-size="${size}" font-family="${FONTS[font] || FONTS.Sans}" font-weight="bold" text-anchor="middle" fill="${color}">${esc(l)}</text>`).join('');
    return svgWrap(Math.ceil(w), Math.ceil(h), rows);
  }

  /* ---------- Backdrops ---------- */
  const BACKDROPS = {
    'Blank': () => svgWrap(480, 360, `<rect width="480" height="360" fill="#ffffff"/>`),
    'Sky': () => svgWrap(480, 360, `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ec6ff"/><stop offset="1" stop-color="#e3f6ff"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/>
      <g fill="#fff" opacity=".9"><ellipse cx="90" cy="70" rx="40" ry="18"/><ellipse cx="120" cy="60" rx="30" ry="20"/><ellipse cx="360" cy="110" rx="50" ry="20"/><ellipse cx="390" cy="98" rx="30" ry="22"/></g>`),
    'Grassland': () => svgWrap(480, 360, `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset="1" stop-color="#d8f4ff"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/>
      <circle cx="400" cy="60" r="34" fill="#ffe56b"/><ellipse cx="240" cy="330" rx="300" ry="60" fill="#5cb83a"/><ellipse cx="60" cy="350" rx="160" ry="40" fill="#4aa52d"/><rect y="340" width="480" height="20" fill="#4aa52d"/>`),
    'Space': () => svgWrap(480, 360, `<rect width="480" height="360" fill="#0b1030"/>` +
      Array.from({ length: 70 }, (_, i) => { const x = (i * 97) % 480, y = (i * 53) % 360, r = (i % 3) * 0.6 + 0.6; return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.5 + (i % 5) / 10}"/>`; }).join('') +
      `<circle cx="400" cy="70" r="30" fill="#c9d6ff"/><circle cx="390" cy="62" r="6" fill="#aab6e0"/><circle cx="410" cy="82" r="4" fill="#aab6e0"/>`),
    'Night City': () => svgWrap(480, 360, `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a3a"/><stop offset="1" stop-color="#3b2a63"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/>` +
      Array.from({ length: 14 }, (_, i) => { const w = 30 + (i * 17) % 30, h = 90 + (i * 43) % 150, x = i * 36; return `<rect x="${x}" y="${360 - h}" width="${w}" height="${h}" fill="#1c1f3a"/>` + Array.from({ length: 6 }, (_, j) => `<rect x="${x + 5 + (j % 2) * 12}" y="${360 - h + 10 + Math.floor(j / 2) * 22}" width="6" height="8" fill="${(i + j) % 3 ? '#ffe39b' : '#333'}"/>`).join(''); }).join('') +
      `<rect y="340" width="480" height="20" fill="#111"/>`),
    'Underwater': () => svgWrap(480, 360, `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fb7e8"/><stop offset="1" stop-color="#0b4f80"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/>
      <path d="M0 330 Q60 300 120 330 T240 330 T360 330 T480 330 V360 H0 Z" fill="#d9c58a"/>
      <g fill="none" stroke="#2e8b57" stroke-width="8" stroke-linecap="round"><path d="M60 340 Q50 300 70 270 Q60 240 80 220"/><path d="M400 340 Q420 300 400 270 Q420 240 400 210"/></g>` +
      Array.from({ length: 12 }, (_, i) => `<circle cx="${(i * 83) % 480}" cy="${(i * 61) % 300}" r="${3 + i % 4}" fill="#fff" opacity=".35"/>`).join('')),
    'Desert': () => svgWrap(480, 360, `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#ffe3a3"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/>
      <circle cx="90" cy="80" r="36" fill="#fff3b0"/><ellipse cx="300" cy="330" rx="320" ry="70" fill="#e9b96e"/><ellipse cx="80" cy="350" rx="200" ry="40" fill="#d9a35b"/>
      <rect x="380" y="240" width="12" height="80" rx="6" fill="#3a7d3a"/><rect x="364" y="260" width="10" height="30" rx="5" fill="#3a7d3a"/><rect x="398" y="252" width="10" height="34" rx="5" fill="#3a7d3a"/>`),
    'Dungeon': () => svgWrap(480, 360, `<rect width="480" height="360" fill="#2b2b35"/>` +
      Array.from({ length: 9 }, (_, r) => Array.from({ length: 10 }, (_, c) => `<rect x="${c * 48 + (r % 2) * 24 - 24}" y="${r * 40}" width="46" height="38" rx="3" fill="${(r + c) % 2 ? '#3a3a48' : '#343442'}"/>`).join('')).join('') +
      `<rect x="200" y="40" width="80" height="120" rx="40" fill="#111"/><rect x="60" y="100" width="18" height="40" fill="#5a4a2a"/><ellipse cx="69" cy="92" rx="12" ry="18" fill="#ffb13b"/><ellipse cx="69" cy="96" rx="6" ry="10" fill="#fff0a0"/>`),
    'Checker': () => svgWrap(480, 360, `<rect width="480" height="360" fill="#f3f3f3"/>` +
      Array.from({ length: 9 }, (_, r) => Array.from({ length: 12 }, (_, c) => (r + c) % 2 ? `<rect x="${c * 40}" y="${r * 40}" width="40" height="40" fill="#e0e0e0"/>` : '').join('')).join('')),
    'Arena': () => svgWrap(480, 360, `<rect width="480" height="360" fill="#1d2b3a"/><rect x="20" y="20" width="440" height="320" rx="16" fill="none" stroke="#3fd0c9" stroke-width="6"/><line x1="240" y1="20" x2="240" y2="340" stroke="#3fd0c9" stroke-width="4" stroke-dasharray="14 10"/><circle cx="240" cy="180" r="50" fill="none" stroke="#3fd0c9" stroke-width="4"/>`)
  };

  /* ---------- Synth sounds (sfxr-style) ---------- */
  const SOUND_PRESETS = {
    'Jump':      { type: 'square', f0: 300, f1: 900, dur: 0.18, decay: 0.15, vol: 0.4 },
    'Coin':      { type: 'square', f0: 988, f1: 1319, dur: 0.22, step: 0.08, decay: 0.2, vol: 0.35 },
    'Laser':     { type: 'sawtooth', f0: 1400, f1: 200, dur: 0.25, decay: 0.2, vol: 0.35 },
    'Explosion': { type: 'noise', f0: 800, f1: 60, dur: 0.6, decay: 0.55, vol: 0.6 },
    'Hit':       { type: 'noise', f0: 500, f1: 150, dur: 0.15, decay: 0.12, vol: 0.5 },
    'Power Up':  { type: 'square', f0: 400, f1: 1600, dur: 0.5, slide: 'up', vib: 30, decay: 0.45, vol: 0.35 },
    'Blip':      { type: 'square', f0: 700, f1: 700, dur: 0.07, decay: 0.06, vol: 0.3 },
    'Click':     { type: 'triangle', f0: 1200, f1: 600, dur: 0.05, decay: 0.04, vol: 0.4 },
    'Win':       { type: 'square', notes: [523, 659, 784, 1047], dur: 0.6, vol: 0.35 },
    'Lose':      { type: 'sawtooth', notes: [392, 349, 311, 262], dur: 0.8, vol: 0.35 },
    'Boing':     { type: 'sine', f0: 200, f1: 700, dur: 0.3, vib: 60, decay: 0.28, vol: 0.4 },
    'Splash':    { type: 'noise', f0: 2000, f1: 300, dur: 0.35, decay: 0.3, vol: 0.4 },
    'Whoosh':    { type: 'noise', f0: 300, f1: 1800, dur: 0.3, decay: 0.28, vol: 0.3 },
    'Alarm':     { type: 'square', notes: [880, 660, 880, 660], dur: 0.8, vol: 0.3 },
    'Meow':      { type: 'sawtooth', f0: 500, f1: 900, dur: 0.4, vib: 12, decay: 0.38, vol: 0.3, f2: 400 },
    'Bark':      { type: 'sawtooth', f0: 220, f1: 130, dur: 0.2, decay: 0.18, vol: 0.5 },
    'Pop':       { type: 'sine', f0: 900, f1: 300, dur: 0.08, decay: 0.07, vol: 0.5 },
    'Drum Kick': { type: 'sine', f0: 150, f1: 40, dur: 0.25, decay: 0.22, vol: 0.8 },
    'Drum Snare':{ type: 'noise', f0: 1800, f1: 1200, dur: 0.18, decay: 0.16, vol: 0.5 },
    'Hi-Hat':    { type: 'noise', f0: 8000, f1: 6000, dur: 0.06, decay: 0.05, vol: 0.3 }
  };

  function renderSynth(ctx, preset) {
    const p = typeof preset === 'string' ? SOUND_PRESETS[preset] : preset;
    if (!p) return null;
    const sr = ctx.sampleRate, n = Math.floor(sr * p.dur), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    let phase = 0, noiseVal = 0, lastT = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      let f;
      if (p.notes) { f = p.notes[Math.min(p.notes.length - 1, Math.floor(t * p.notes.length))]; }
      else if (p.step) { f = t < 0.4 ? p.f0 : p.f1; }
      else { f = p.f0 + (p.f1 - p.f0) * (p.f2 ? Math.sin(t * Math.PI) : t); }
      if (p.vib) f += Math.sin(i / sr * p.vib * Math.PI * 2) * f * 0.05;
      phase += f / sr;
      let s;
      switch (p.type) {
        case 'square': s = (phase % 1) < 0.5 ? 1 : -1; break;
        case 'sawtooth': s = (phase % 1) * 2 - 1; break;
        case 'triangle': s = Math.abs((phase % 1) * 4 - 2) - 1; break;
        case 'noise': { // filtered noise, resampled by frequency
          if (phase - lastT > 1) { noiseVal = Math.random() * 2 - 1; lastT = phase; }
          s = noiseVal; break;
        }
        default: s = Math.sin(phase * Math.PI * 2);
      }
      const env = p.notes ? Math.min(1, (1 - (t * p.notes.length) % 1) * 3) : Math.max(0, 1 - (i / sr) / (p.decay || p.dur));
      const attack = Math.min(1, i / (sr * 0.005));
      d[i] = s * env * attack * (p.vol || 0.4);
    }
    return buf;
  }

  // note number (MIDI) -> buffer with a soft piano-ish tone
  function renderNote(ctx, midi, secs, wave = 'triangle') {
    const f = 440 * Math.pow(2, (midi - 69) / 12), sr = ctx.sampleRate, n = Math.floor(sr * secs), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / sr, ph = t * f;
      let s = wave === 'square' ? ((ph % 1) < 0.5 ? 1 : -1) * 0.5 : wave === 'sawtooth' ? ((ph % 1) * 2 - 1) * 0.6 : Math.sin(ph * Math.PI * 2) * 0.8 + Math.sin(ph * Math.PI * 4) * 0.25;
      const env = Math.min(1, i / (sr * 0.01)) * Math.exp(-t * 3) * (1 - t / secs);
      d[i] = s * env * 0.4;
    }
    return buf;
  }

  const DRUMS = { 'kick': 'Drum Kick', 'snare': 'Drum Snare', 'hi-hat': 'Hi-Hat', 'clap': 'Hit', 'tom': 'Boing', 'cymbal': 'Splash' };

  window.SparkLib = {
    COSTUMES, costumeNames: Object.keys(COSTUMES), COLORS,
    costumeSVG: (name, color) => { const c = COSTUMES[name]; return c ? c.svg(color || '#4C97FF') : null; },
    BACKDROPS, backdropNames: Object.keys(BACKDROPS),
    backdropSVG: name => (BACKDROPS[name] || BACKDROPS.Blank)(),
    emojiSVG, textSVG, FONTS,
    SOUND_PRESETS, soundNames: Object.keys(SOUND_PRESETS).filter(n => !n.startsWith('Drum') && n !== 'Hi-Hat'),
    renderSynth, renderNote, DRUMS,
    svgToDataURL: svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  };
})();
