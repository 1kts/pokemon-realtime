// Tests e2e: el juego de verdad en un navegador de verdad. Arranca el servidor (con una base de datos
// temporal y ARENA_DEV para el gancho de pruebas), abre Chromium sin ventana y lo maneja por el
// protocolo de depuración (sin dependencias: usa el Chrome que haya en la máquina). Cada archivo
// tests/e2e/*.e2e.js exporta async (t) => { … } y usa la API de abajo; cualquier error de JavaScript
// o violación de la CSP en la página hace fallar el test. Si exporta también `env` ({ VARIABLE: valor }),
// su servidor arranca con esas variables de más (p. ej. las de entrar con Google en pruebas).
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
async function setup(name, extraEnv = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-e2e-'));
  const port = await freePort(), dbg = await freePort();
  const env = { ...process.env, ...extraEnv, PORT: String(port), DB_FILE: path.join(tmp, 'arena.db'), ARENA_DEV: '1', HOST: '127.0.0.1' };
  const server = spawn(process.execPath, ['--no-warnings', 'server.js'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'pipe'] });
  let serverErr = '';
  server.stderr.on('data', d => { serverErr += d; });
  const base = `http://127.0.0.1:${port}`;
  await waitHttp(base + '/healthz');
  const chromePath = findChrome();
  if (!chromePath) throw new Error('No encuentro Chrome/Chromium: instala uno o pon su ruta en CHROME');
  const chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    `--remote-debugging-port=${dbg}`, `--user-data-dir=${path.join(tmp, 'chrome')}`, '--window-size=1280,860',
    '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
  // E2E_SLOW=4: el navegador va 4 veces más lento, para reproducir aquí lo que solo falla en el CI (máquinas lentas)
  if (+process.env.E2E_SLOW > 1) await call('Emulation.setCPUThrottlingRate', { rate: +process.env.E2E_SLOW });
  // El premio diario se abre solo una vez al día: en las pruebas cuenta como ya visto (si no, taparía la
  // pantalla en todas); la del premio diario lo quita poniendo 'arena.dailySeen' a 'nunca'
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `try { if (!localStorage.getItem('arena.dailySeen')) localStorage.setItem('arena.dailySeen', new Date().toISOString().slice(0, 10)); } catch {}` });

  const page = {
    base,
    // Evalúa una expresión en la página (puede devolver una promesa) y devuelve su valor
    async eval(expr) {
      const r = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('En la página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split('\n')[0]);
      return r.result.value;
    },
    // (cargar la página puede tardar con varias pruebas a la vez: hasta 30 s)
    async goto(p) { await call('Page.navigate', { url: base + p }); await page.waitFor('document.readyState === "complete"', 30000); },
    async reload() { await call('Page.reload'); await sleep(200); await page.waitFor('document.readyState === "complete"', 30000); },
    // Espera a que una expresión sea verdadera (15 s por defecto: con varias pruebas a la vez el CI va lento)
    async waitFor(expr, ms = 15000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { try { if (await page.eval(`!!(${expr})`)) return; } catch {} await sleep(100); }
      throw new Error(`Tiempo agotado esperando: ${expr}`);
    },
    // Pulsa como un jugador el elemento de un selector CSS (o el primer botón/enlace visible cuyo texto contenga
    // `text`): lo pone a la vista, espera a que se pueda pulsar (dentro de la pantalla, activo y sin nada encima,
    // hasta 3 s: animaciones, ventanas que se abren) y hace un clic de ratón de verdad en su centro. Si algo lo
    // tapa, falla diciendo qué: así se ven los avisos o barras que tapan botones
    async click(textOrSel) {
      const where = `(() => { const s = ${JSON.stringify(textOrSel)};
        const shown = x => x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden';
        let e = null;
        try { e = document.querySelector(s); } catch { /* no es un selector: se busca por texto */ }
        if (!e) e = [...document.querySelectorAll('button, a, summary, [role=button]')].find(x => shown(x) && x.textContent.trim().toLowerCase().includes(s.toLowerCase()));
        if (!e) return { err: 'no está' };
        e.scrollIntoView({ block: 'center', inline: 'center' });
        const b = e.getBoundingClientRect();
        if (!b.width || !b.height || !shown(e)) return { err: 'no se ve' };
        const x = Math.min(innerWidth - 1, Math.max(0, b.x + b.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, b.y + b.height / 2));
        if (b.right < 1 || b.bottom < 1 || b.left > innerWidth - 1 || b.top > innerHeight - 1) return { err: 'fuera de la pantalla' };
        if (e.disabled) return { err: 'desactivado' };
        // (una animación de entrada en él o en lo que lo contiene, p. ej. una ventana que crece: se espera a que acabe,
        // como mucho 1,2 s; después basta con que esté quieto, de sitio y de tamaño, que algunas duran más y no lo mueven)
        if (!window.__e2eAnimOk && document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.contains && a.effect.target.contains(e) && a.effect.getTiming().iterations !== Infinity)) return { err: 'moviéndose' };
        const top = document.elementFromPoint(x, y);
        const name = n => n ? n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\\s+/).join('.') : '') : 'nada';
        if (!top || !(top === e || e.contains(top) || (e.htmlFor && top.id === e.htmlFor))) return { err: 'tapado por ' + name(top) };
        return { x, y, w: Math.round(b.width), h: Math.round(b.height) }; })()`;
      // (y quieto: la misma posición en dos lecturas seguidas, que una ventana o ficha que entra con animación no se mueva bajo el clic)
      const t0 = Date.now();
      await page.eval('window.__e2eAnimOk = false; true');
      // (con la máquina muy cargada una sola lectura puede tardar segundos: siempre unas cuantas, aunque pasen los 4 s)
      let r = await page.eval(where), prev = null, reads = 1;
      while ((r.err || !prev || prev.x !== r.x || prev.y !== r.y || prev.w !== r.w || prev.h !== r.h) && (Date.now() - t0 < 4000 || reads < 5)) {
        prev = r.err ? null : r; await sleep(80); reads++;
        if (Date.now() - t0 > 1200) await page.eval('window.__e2eAnimOk = true; true');
        r = await page.eval(where);
      }
      if (r.err) throw new Error(`No se puede pulsar «${textOrSel}»: ${r.err}`);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await call('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
      await sleep(150);
    },
    // (antes era un clic de mentira y este el de verdad; ahora los dos son de verdad)
    async realClick(sel) { await page.click(sel); },
    // Escribe en un campo como un teclado: lo enfoca, borra lo que haya y mete el texto (eventos input reales);
    // al acabar, change (como al salir del campo)
    async type(sel, text) {
      // (borrar lo que haya como un usuario: seleccionarlo y suprimirlo, que avisa al campo aunque se escriba '')
      const ok = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
        e.scrollIntoView({ block: 'center' }); e.focus(); if (e.value) { e.select(); document.execCommand('delete'); } return document.activeElement === e; })()`);
      if (!ok) throw new Error('No encuentro el campo (o no se puede escribir en él): ' + sel);
      if (text) await call('Input.insertText', { text });
      await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
      await sleep(100);
    },
    // El dedo de verdad (eventos táctiles del navegador): fingerDown pone el dedo sobre el elemento, fingerUp lo
    // levanta; press es un toque de `ms` milisegundos (corto, o una pulsación larga)
    async fingerDown(sel) {
      const r = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center' });
        const b = e.getBoundingClientRect(); return { x: b.left + Math.min(8, b.width / 2), y: b.top + Math.min(8, b.height / 2) }; })()`);
      if (!r) throw new Error('No encuentro qué tocar: ' + sel);
      await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] });
    },
    async fingerUp() { await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(80); },
    async press(sel, ms = 60) { await page.fingerDown(sel); await sleep(ms); await page.fingerUp(); },
    // Mueve un deslizador (input range) como con el dedo: pulsa en el punto de su barra que da ese valor
    async slide(sel, value) {
      const r = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center' });
        // (el centro del tirador recorre la barra menos su ancho: en Chrome, 16 px)
        const b = e.getBoundingClientRect(), min = +e.min || 0, max = e.max === '' ? 100 : +e.max, f = (${+value} - min) / (max - min), th = 16;
        return { x: b.left + th / 2 + f * (b.width - th), y: b.top + b.height / 2 }; })()`);
      if (!r) throw new Error('No encuentro el deslizador: ' + sel);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await call('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
      await sleep(150);
    },
    // Cambia el tamaño de la ventana (una pantalla estrecha, un móvil…); resize() sin argumentos la deja como estaba
    async resize(width, height) {
      if (width) await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      else await call('Emulation.clearDeviceMetricsOverride');
      await sleep(300);
    },
    // Preferencias del sistema que ve la página, p. ej. media([{ name: 'prefers-reduced-motion', value: 'reduce' }]); media() las quita
    async media(features = []) { await call('Emulation.setEmulatedMedia', { features }); await sleep(100); },
    async shot(file) { const r = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); },
    // Entra al menú con una sesión ya hecha (el perfil se crea por WebSocket y aquí se usa su token),
    // pulsando «Continuar como…» en la portada como haría el jugador
    async loginAs(token, lang = 'es') {
      await page.goto('/');
      await page.eval(`(() => { localStorage.setItem('arena.token', ${JSON.stringify(token)}); localStorage.setItem('arena.name', 'e2e');
        localStorage.setItem('arena.lang', ${JSON.stringify(lang)}); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); return true; })()`);
      await page.reload();
      await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000);
      await page.click('.title-panel button.primary');
      await page.waitFor(`window.__app.ui.view === 'menu'`, 20000);
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
// Cada prueba tiene su servidor y su Chrome (puertos y carpetas propios), así que se pasan varias a la vez:
//   E2E_JOBS=n    cuántas a la vez (por defecto 4, o 1 con E2E_SLOW)
//   E2E_SHARD=i/n solo el trozo i de n (el CI reparte las pruebas en varias máquinas)
// Lo que escribe cada prueba se guarda y sale junto al terminar, para que no se mezclen.
async function runOne(file) {
  const name = path.basename(file).replace(/\.e2e\.js$/, '');
  const out = [`▶ ${name}`], t0 = Date.now();
  let ctx, results = [];
  const t = { ok: (cond, msg) => { results.push([!!cond, msg]); out.push(`  ${cond ? '✓' : '✗'} ${msg}`); }, log: msg => out.push('    ' + msg) };
  try {
    const test = require(path.resolve(file));
    ctx = await setup(name, test.env);
    Object.assign(t, ctx);
    // Como mucho 5 minutos por prueba (con varias a la vez y el 3D por software del CI van más lentas): un test
    // colgado no bloquea el CI
    await Promise.race([test(t),
      new Promise((_, j) => setTimeout(() => j(new Error('más de 5 minutos: algo se ha quedado esperando')), 300e3).unref())]);
    if (ctx.page.problems.length) t.ok(false, 'sin errores de JavaScript ni de CSP en la página:\n      ' + ctx.page.problems.join('\n      '));
    const external = ctx.page.requests.filter(u => !u.startsWith(ctx.page.base) && !u.startsWith('data:') && !u.startsWith('blob:') && u !== 'about:blank');
    if (external.length) t.ok(false, 'nada cargado de terceros: ' + [...new Set(external)].slice(0, 5).join(', '));
  } catch (e) {
    t.ok(false, 'error: ' + e.message);
    // (la captura, como mucho 20 s: con la página bloqueada no llega nunca y dejaba colgado el trozo entero del CI)
    if (ctx) { const shot = path.join(os.tmpdir(), `e2e-${name}.png`); try { await Promise.race([ctx.page.shot(shot), new Promise((_, j) => setTimeout(() => j(new Error('sin captura')), 20e3).unref())]); out.push(`    captura: ${shot}`); } catch {} }
  } finally { if (ctx) await ctx.teardown(); }
  if (process.env.E2E_TIMES) out[0] += ` (${((Date.now() - t0) / 1000).toFixed(1)} s)`;
  return { name, out, failed: results.some(r => !r[0]) || !results.length };
}

async function run(files) {
  const jobs = Math.max(1, +process.env.E2E_JOBS || (+process.env.E2E_SLOW > 1 ? 1 : 4));
  const queue = [...files], done = [];
  const worker = async () => { while (queue.length) { const r = await runOne(queue.shift()); console.log(r.out.join('\n')); done.push(r); } };
  await Promise.all(Array.from({ length: Math.min(jobs, files.length) }, worker));
  const failed = done.filter(r => r.failed);
  if (failed.length > 1 || (failed.length && files.length > 1)) console.log(`\nFallan: ${failed.map(r => r.name).join(', ')}`);
  console.log(failed.length ? `\n${failed.length} de ${files.length} pruebas e2e fallan` : `\nTodas las pruebas e2e correctas (${files.length})`);
  return failed.length;
}

if (require.main === module) {
  const dir = path.join(ROOT, 'tests', 'e2e');
  let files = process.argv.slice(2).length ? process.argv.slice(2)
    : fs.readdirSync(dir).filter(f => f.endsWith('.e2e.js')).sort().map(f => path.join(dir, f));
  // Lo que tarda cada una (tests/e2e/times.json; las nuevas, 60 s): primero las lentas, para que al final no quede una
  // larga sola mientras los demás hilos ya han acabado
  let times = {};
  try { times = JSON.parse(fs.readFileSync(path.join(dir, 'times.json'), 'utf8')); } catch {}
  const cost = f => times[path.basename(f).replace(/\.e2e\.js$/, '')] || 60;
  files.sort((a, b) => cost(b) - cost(a));
  // Trozo i de n (1..n): se reparten por tiempo, la siguiente más lenta al trozo que menos lleva, para que todas las
  // máquinas del CI acaben a la vez
  const shard = String(process.env.E2E_SHARD || '').match(/^(\d+)\/(\d+)$/);
  if (shard) {
    const n = +shard[2], load = new Array(n).fill(0), mine = [];
    for (const f of files) { const k = load.indexOf(Math.min(...load)); load[k] += cost(f); if (k === +shard[1] - 1) mine.push(f); }
    files = mine;
  }
  run(files).then(f => process.exit(f ? 1 : 0), e => { console.error(e); process.exit(1); });
}

module.exports = { setup, run, findChrome };
