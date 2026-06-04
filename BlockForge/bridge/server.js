#!/usr/bin/env node
/* ============================================================
   BlockForge Bridge Server  (zero dependencies)
   - serves the BlockForge app
   - relays live commands Claude -> browser  (Server-Sent Events)
   - reads the browser's live project state  back to Claude
   Run:  node bridge/server.js     then open http://localhost:4321
   ============================================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');      // the BlockForge directory
const PORT = process.env.BF_PORT || 4321;

let clients = [];     // open SSE responses (browsers)
let lastState = null; // most recent project state pushed by a browser
let lastSeen = 0;

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.map':'application/json' };

function cors(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
}
function readBody(req){
  return new Promise(r=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>r(b)); });
}
function broadcast(obj){
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  clients.forEach(c=>{ try{ c.write(line); }catch(e){} });
  return clients.length;
}

const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, `http://localhost:${PORT}`);
  cors(res);
  if(req.method==='OPTIONS'){ res.writeHead(204); return res.end(); }

  /* ---- SSE stream to browsers ---- */
  if(url.pathname==='/events'){
    res.writeHead(200,{ 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache',
      'Connection':'keep-alive', 'X-Accel-Buffering':'no' });
    res.write(`retry: 1500\n`);
    res.write(`data: ${JSON.stringify({action:'_connected'})}\n\n`);
    clients.push(res);
    const hb = setInterval(()=>{ try{ res.write(': ping\n\n'); }catch(e){} }, 20000);
    req.on('close', ()=>{ clearInterval(hb); clients = clients.filter(c=>c!==res); });
    return;
  }

  /* ---- Claude -> browser command ---- */
  if(url.pathname==='/push' && req.method==='POST'){
    const body = await readBody(req);
    let cmd; try{ cmd = JSON.parse(body); }catch(e){ res.writeHead(400); return res.end('{"error":"bad json"}'); }
    const n = broadcast(cmd);
    res.writeHead(200,{'Content-Type':'application/json'});
    return res.end(JSON.stringify({ ok:true, delivered:n }));
  }

  /* ---- browser -> Claude live state ---- */
  if(url.pathname==='/state'){
    if(req.method==='POST'){
      const body = await readBody(req);
      try{ lastState = JSON.parse(body); lastSeen = Date.now(); }catch(e){}
      res.writeHead(200,{'Content-Type':'application/json'}); return res.end('{"ok":true}');
    }
    res.writeHead(200,{'Content-Type':'application/json'});
    return res.end(JSON.stringify({ connected:clients.length, ageMs: lastState?Date.now()-lastSeen:null, project:lastState }));
  }

  /* ---- status ping ---- */
  if(url.pathname==='/bridge'){
    res.writeHead(200,{'Content-Type':'application/json'});
    return res.end(JSON.stringify({ ok:true, browsers:clients.length, hasState:!!lastState }));
  }

  /* ---- static files ---- */
  let p = decodeURIComponent(url.pathname);
  if(p==='/') p='/index.html';
  const file = path.join(ROOT, p);
  if(!file.startsWith(ROOT)){ res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err,data)=>{
    if(err){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200,{'Content-Type': MIME[path.extname(file)]||'application/octet-stream'});
    res.end(data);
  });
});

server.listen(PORT, ()=>{
  console.log(`\n  ⚡ BlockForge Bridge running`);
  console.log(`  → open   http://localhost:${PORT}`);
  console.log(`  → Claude pushes commands to POST /push, reads GET /state\n`);
});
