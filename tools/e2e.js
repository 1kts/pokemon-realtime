// Tests e2e: el juego de verdad en un navegador de verdad. Arranca el servidor (con una base de datos
// temporal y ARENA_DEV para el gancho de pruebas), abre Chromium sin ventana y lo maneja por el
// protocolo de depuración (sin dependencias: usa el Chrome que haya en la máquina). Cada archivo
// tests/e2e/*.e2e.js exporta async (t) => { … } y usa la API de abajo; cualquier error de JavaScript
// o violación de la CSP en la página hace fallar el test.
//   node tools/e2e.js                       todos
//   node tools/e2e.js tests/e2e/portada.e2e.js   uno
// Chrome: variable CHROME, o google-chrome / chromium / el de Playwright si está en la caché.
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn, execFileSync } = require('child_process');
const WebSocket = require('ws');

const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function findChrome() {
  const cands = [process.env.CHROME, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const c of cands) {
    try { return c.includes('/') ? (fs.existsSync(c) && c) || null : execFileSync('which', [c], { encoding: 'utf8' }).trim(); } catch {}
  }
  const pw = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (fs.existsSync(pw)) for (const d of fs.readdirSync(pw).filter(d => d.startsWith('chromium-')).sort().reverse()) {
    const f = path.join(pw, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(f)) return f;
  }
  return null;
}
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

async function waitHttp(url, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if ((await fetch(url)).ok) return; } catch {} await sleep(100); }
  throw new Error('El servidor no arranca: ' + url);
}

// ---------- Servidor y navegador de una prueba ----------
async function setup(name) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-e2e-'));
  const port = await freePort(), dbg = await freePort();
  const env = { ...process.env, PORT: String(port), DB_FILE: path.join(tmp, 'arena.db'), ARENA_DEV: '1', HOST: '127.0.0.1' };
  const server = spawn(process.execPath, ['--no-warnings', 'server.js'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'pipe'] });
  let serverErr = '';
  server.stderr.on('data', d => { serverErr += d; });
  const base = `http://127.0.0.1:${port}`;
  await waitHttp(base + '/healthz');
  const chromePath = findChrome();
  if (!chromePath) throw new Error('No encuentro Chrome/Chromium: instala uno o pon su ruta en CHROME');
  const chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    `--remote-debugging-port=${dbg}`, `--user-data-dir=${path.join(tmp, 'chrome')}`, '--window-size=1280,860', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 100 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${dbg}/json`)).json()).find(x => x.type === 'page'); } catch {} if (!target) await sleep(100); }
  if (!target) throw new Error('Chrome no abre la página de depuración');
  const cdp = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { cdp.on('open', r); cdp.on('error', j); });
  let id = 0;
  const pending = new Map(), problems = [], requests = [];
  cdp.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') problems.push('JS: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
    if (m.method === 'Log.entryAdded' && /Content Security Policy|Refused to/.test(m.params.entry.text)) problems.push('CSP: ' + m.params.entry.text);
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); cdp.send(JSON.stringify({ id: i, method, params })); });
  await call('Runtime.enable'); await call('Log.enable'); await call('Page.enable'); await call('Network.enable');

  const page = {
    base,
    // Evalúa una expresión en la página (puede devolver una promesa) y devuelve su valor
    async eval(expr) {
      const r = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('En la página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
      return r.result.value;
    },
    async goto(p) { await call('Page.navigate', { url: base + p }); await page.waitFor('document.readyState === "complete"'); },
    async reload() { await call('Page.reload'); await sleep(200); await page.waitFor('document.readyState === "complete"'); },
    // Espera a que una expresión sea verdadera
    async waitFor(expr, ms = 8000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { try { if (await page.eval(`!!(${expr})`)) return; } catch {} await sleep(100); }
      throw new Error(`Tiempo agotado esperando: ${expr}`);
    },
    // Pulsa el primer botón/enlace visible cuyo texto contenga `text` (o el elemento de un selector CSS)
    async click(textOrSel) {
      const ok = await page.eval(`(() => { const s = ${JSON.stringify(textOrSel)};
        let e = null;
        try { e = document.querySelector(s); } catch { /* no es un selector: se busca por texto */ }
        if (!e) e = [...document.querySelectorAll('button, a, summary, [role=button]')].find(x => x.offsetParent !== null && x.textContent.trim().toLowerCase().includes(s.toLowerCase()));
        if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true; })()`);
      if (!ok) throw new Error('No encuentro qué pulsar: ' + textOrSel);
      await sleep(150);
    },
    // Escribe en un campo (como si tecleara: dispara input y change)
    async type(sel, text) {
      const ok = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
        e.focus(); e.value = ${JSON.stringify(text)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
      if (!ok) throw new Error('No encuentro el campo: ' + sel);
      await sleep(100);
    },
    async shot(file) { const r = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); },
    // Entra al menú con una sesión ya hecha (el perfil se crea por WebSocket y aquí se usa su token),
    // pulsando «Continuar como…» en la portada como haría el jugador
    async loginAs(token, lang = 'es') {
      await page.goto('/');
      await page.eval(`(() => { localStorage.setItem('arena.token', ${JSON.stringify(token)}); localStorage.setItem('arena.name', 'e2e');
        localStorage.setItem('arena.lang', ${JSON.stringify(lang)}); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); return true; })()`);
      await page.reload();
      await page.waitFor(`document.querySelector('.title-panel button.primary')`);
      await page.click('.title-panel button.primary');
      await page.waitFor(`window.__app.ui.view === 'menu'`);
    },
    problems, requests,
  };

  // Cliente WebSocket directo al servidor, para preparar datos (perfiles, Pokémon…) sin pasar por la interfaz
  async function client() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const msgs = [];
    ws.on('message', d => msgs.push(JSON.parse(d)));
    await new Promise(r => ws.on('open', r));
    let rid = 0;
    const c = {
      send: m => ws.send(JSON.stringify(m)),
      async wait(pred, ms = 5000) {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { const i = msgs.findIndex(pred); if (i >= 0) return msgs.splice(i, 1)[0]; await sleep(30); }
        throw new Error('Sin respuesta del servidor');
      },
      async ask(t, data = {}) { const r = ++rid; c.send({ t, rid: r, ...data }); return c.wait(m => m.rid === r); },
      close: () => ws.close(),
    };
    return c;
  }
  // Un jugador con perfil (y, si se da user, con cuenta): devuelve { token, id, client }
  async function player({ name = 'Tester', user, pass = 'clave-e2e-123' } = {}) {
    const c = await client();
    if (user) { c.send({ t: 'register', user, pass }); await c.wait(m => m.t === 'authok'); }
    else c.send({ t: 'hello', name });
    const m = await c.wait(x => x.t === 'profile');
    return { token: m.p.token, id: m.p.id, client: c, profile: m.p };
  }

  // Limpiar nunca hace fallar una prueba: se espera a que Chrome y el servidor terminen de verdad (si no,
  // Chrome puede seguir escribiendo en su carpeta mientras se borra) y el borrado se reintenta
  const gone = p => new Promise(r => { if (p.exitCode !== null || p.signalCode) return r(); p.once('exit', r); setTimeout(r, 5000).unref(); });
  const teardown = async () => {
    try { cdp.close(); } catch {}
    chrome.kill('SIGKILL'); server.kill('SIGKILL');
    await Promise.all([gone(chrome), gone(server)]);
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (e) { console.log(`    (no se pudo borrar ${tmp}: ${e.code})`); }
  };
  return { page, client, player, env, tmp, teardown, serverErr: () => serverErr };
}

// ---------- Runner ----------
async function run(files) {
  let failed = 0;
  for (const file of files) {
    const name = path.basename(file).replace(/\.e2e\.js$/, '');
    let ctx, results = [];
    const t = { ok: (cond, msg) => { results.push([!!cond, msg]); console.log(`  ${cond ? '✓' : '✗'} ${msg}`); } };
    console.log(`▶ ${name}`);
    try {
      ctx = await setup(name);
      Object.assign(t, ctx);
      // Como mucho 2 minutos por prueba: un test colgado no puede bloquear el push
      await Promise.race([require(path.resolve(file))(t),
        new Promise((_, j) => setTimeout(() => j(new Error('más de 2 minutos: algo se ha quedado esperando')), 120e3).unref())]);
      if (ctx.page.problems.length) t.ok(false, 'sin errores de JavaScript ni de CSP en la página:\n      ' + ctx.page.problems.join('\n      '));
      const external = ctx.page.requests.filter(u => !u.startsWith(ctx.page.base) && !u.startsWith('data:') && !u.startsWith('blob:') && u !== 'about:blank');
      if (external.length) t.ok(false, 'nada cargado de terceros: ' + [...new Set(external)].slice(0, 5).join(', '));
    } catch (e) {
      t.ok(false, 'error: ' + e.message);
      if (ctx) { const shot = path.join(os.tmpdir(), `e2e-${name}.png`); try { await ctx.page.shot(shot); console.log(`    captura: ${shot}`); } catch {} }
    } finally { if (ctx) await ctx.teardown(); }
    if (results.some(r => !r[0]) || !results.length) failed++;
  }
  console.log(failed ? `\n${failed} de ${files.length} pruebas e2e fallan` : `\nTodas las pruebas e2e correctas (${files.length})`);
  return failed;
}

if (require.main === module) {
  const dir = path.join(ROOT, 'tests', 'e2e');
  const files = process.argv.slice(2).length ? process.argv.slice(2)
    : fs.readdirSync(dir).filter(f => f.endsWith('.e2e.js')).sort().map(f => path.join(dir, f));
  run(files).then(f => process.exit(f ? 1 : 0), e => { console.error(e); process.exit(1); });
}

module.exports = { setup, run, findChrome };
