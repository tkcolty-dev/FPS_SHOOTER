/* The Press — local print server.
   Serves the app and, more importantly, prints for it: the browser hands over
   the exact sheets it built, we render them to a PDF at true size and send that
   straight to CUPS. No print dialog, so nothing can quietly rescale the job. */

const http = require('http');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFile } = require('child_process');

const PORT = Number(process.env.PORT) || 4802;
const ROOT = __dirname;

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find(p => fs.existsSync(p));

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css',
               '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };

const run = (cmd, args, opts = {}) => new Promise((resolve, reject) =>
  execFile(cmd, args, { maxBuffer: 1 << 28, ...opts }, (err, stdout, stderr) =>
    err ? reject(new Error((stderr || err.message).trim())) : resolve(stdout)));

const json = (res, code, body) => {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(s) });
  res.end(s);
};

/* ── which printers exist, and which is the default ── */
async function printers(){
  let out = '', def = null;
  try { out = await run('lpstat', ['-p','-d']); } catch { return { list: [], def: null }; }
  const list = [...out.matchAll(/^printer\s+(\S+)/gm)].map(m => m[1]);
  const d = out.match(/system default destination:\s*(\S+)/);
  if(d) def = d[1];
  return { list, def: def || list[0] || null };
}

/* ── take the sheets the page built, make a PDF, send it to CUPS ── */
async function printJob(body){
  if(!CHROME) throw new Error('Google Chrome is needed to make the PDF, and it was not found.');
  const { html, images = {}, pw, ph, printer, title = 'The Press', copies = 1, gray = false } = body;
  if(!html)    throw new Error('Nothing to print.');
  if(!printer) throw new Error('No printer chosen.');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'press-'));
  try{
    for(const [name, dataUrl] of Object.entries(images)){
      const b64 = String(dataUrl).split(',')[1] || '';
      fs.writeFileSync(path.join(dir, name), Buffer.from(b64, 'base64'));
    }
    fs.writeFileSync(path.join(dir, 'page.html'), html);

    const pdf = path.join(dir, 'sheets.pdf');
    await run(CHROME, ['--headless','--disable-gpu','--no-pdf-header-footer',
                       '--virtual-time-budget=15000',
                       '--print-to-pdf=' + pdf,
                       'file://' + path.join(dir, 'page.html')]);
    if(!fs.existsSync(pdf)) throw new Error('The PDF could not be made.');

    // The PDF already carries the exact page size, so scaling must stay off.
    // Front side only, whatever the printer's own default happens to be.
    // Both spellings are sent: drivers honour one or the other, not always both.
    const args = ['-d', printer, '-t', title, '-n', String(copies),
                  '-o','sides=one-sided', '-o','Duplex=None',
                  '-o','fit-to-page=false'];
    if(gray) args.push('-o','ColorModel=Gray', '-o','print-color-mode=monochrome');
    if(pw > ph) args.push('-o','landscape');
    args.push(pdf);
    const out = await run('lp', args);
    const id = (out.match(/request id is (\S+)/) || [,'sent'])[1];

    const pages = (fs.readFileSync(pdf).toString('latin1').match(/\/Type\s*\/Page(?![s])/g) || []).length;
    return { ok: true, jobId: id, pages };
  } finally {
    setTimeout(() => fs.rm(dir, { recursive:true, force:true }, () => {}), 60000);
  }
}

/* ── server ── */
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if(url.pathname === '/api/printers'){
    return json(res, 200, await printers());
  }

  if(url.pathname === '/api/print' && req.method === 'POST'){
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if(size > 400 * 1024 * 1024){ req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', async () => {
      try {
        const result = await printJob(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        json(res, 200, result);
      } catch (e) {
        json(res, 500, { ok:false, error: e.message });
      }
    });
    return;
  }

  // static
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if(!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
    res.writeHead(404); return res.end('Not found');
  }
  // Never let the browser serve a stale copy of the app.
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
                       'Cache-Control':'no-store, no-cache, must-revalidate', 'Pragma':'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log('The Press is running at http://localhost:' + PORT + '/');
  if(!CHROME) console.log('WARNING: Chrome not found — direct printing will not work.');
});
