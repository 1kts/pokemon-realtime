// Tests e2e: el juego de verdad en un navegador de verdad. Arranca el servidor (con una base de datos
// temporal y ARENA_DEV para el gancho de pruebas), abre Chromium sin ventana y lo maneja por el
// protocolo de depuración (sin dependencias: usa el Chrome que haya en la máquina). Cada archivo
// tests/e2e/*.e2e.js exporta async (t) => { … } y usa la API de abajo; cualquier error de JavaScript
// o violación de la CSP en la página hace fallar el test. Si exporta también `env` ({ VARIABLE: valor }),
// su servidor arranca con esas variables de más (p. ej. las de entrar con Google en pruebas).
//   node tools/e2e.js                       todos
//   node tools/e2e.js tests/e2e/portada.e2e.js   uno
// Chrome: variable CHROME, o google-chrome / chromium / el de Playwright si está en la caché.
// Con E2E_BROWSER=webkit (el Safari del iPhone) o chromium-pw, el navegador lo abre Playwright (npm i --no-save
// playwright; npx playwright install webkit): ver playwrightCall.
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
// En una máquina lenta (E2E_TIMEOUT de más de 300 s) todas las esperas duran más en la misma proporción
const PATIENCE = Math.max(1, (+process.env.E2E_TIMEOUT || 300) / 300);
// Teclas con nombre para page.key: [key, código de tecla]
const KEYS = { Escape: ['Escape', 27], Enter: ['Enter', 13, '\r'], Space: [' ', 32], Tab: ['Tab', 9], Backspace: ['Backspace', 8],
  ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40] };
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

async function waitHttp(url, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if ((await fetch(url)).ok) return; } catch {} await sleep(100); }
  throw new Error('El servidor no arranca: ' + url);
}

const gone = p => new Promise(r => { if (p.exitCode !== null || p.signalCode) return r(); p.once('exit', r); setTimeout(r, 5000).unref(); });

// ---------- Otros navegadores (Playwright) ----------
// E2E_BROWSER=webkit abre WebKit (el motor del Safari del iPhone) con Playwright, y `call` traduce las pocas órdenes
// de CDP que usa el arnés (evaluar, navegar, ratón, teclado, dedo, tamaño, capturas) a las de Playwright: así las
// pruebas son las mismas. Diferencias: sin E2E_SLOW, y el dedo puesto (fingerDown) son eventos de puntero y de toque
// de la página (Playwright solo tiene toques enteros); un toque corto (press) sí es un toque de verdad
async function playwrightCall(kind, problems, requests) {
  let pw;
  try { pw = require('playwright'); } catch { throw new Error('E2E_BROWSER necesita Playwright: npm i --no-save playwright && npx playwright install webkit'); }
  const type = { webkit: pw.webkit, firefox: pw.firefox, 'chromium-pw': pw.chromium }[kind];
  if (!type) throw new Error('E2E_BROWSER: webkit, firefox o chromium-pw');
  const browser = await type.launch(kind === 'chromium-pw' && process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => problems.push('JS: ' + String(e.message).split('\n')[0]));
  p.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) problems.push('CSP: ' + m.text()); });
  p.on('request', r => requests.push(r.url()));
  let finger = null;
  // (el dedo como eventos de la página, en el elemento que hay en ese punto)
  const touch = (type, x, y) => p.evaluate(([type, x, y]) => {
    const e = document.elementFromPoint(x, y) || document.body, o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 11, pointerType: 'touch', isPrimary: true };
    const kind = { start: ['pointerdown', 'touchstart'], move: ['pointermove', 'touchmove'], end: ['pointerup', 'touchend'] }[type];
    e.dispatchEvent(new PointerEvent(kind[0], o));
    try { const t = new Touch({ identifier: 11, target: e, clientX: x, clientY: y }); e.dispatchEvent(new TouchEvent(kind[1], { bubbles: true, cancelable: true, touches: type === 'end' ? [] : [t], changedTouches: [t] })); } catch {}
  }, [type, x, y]);
  const H = {
    'Runtime.evaluate': async ({ expression }) => {
      try { return { result: { value: await p.evaluate(expression) } }; } catch (e) { return { exceptionDetails: { text: String(e.message).replace(/^page\.evaluate: /, '') } }; }
    },
    'Page.navigate': async ({ url }) => { await p.goto(url, { waitUntil: 'commit' }); },
    'Page.reload': async () => { await p.reload({ waitUntil: 'commit' }); },
    'Page.addScriptToEvaluateOnNewDocument': async ({ source }) => { await ctx.addInitScript(source); },
    'Page.captureScreenshot': async () => ({ data: (await p.screenshot()).toString('base64') }),
    'Input.dispatchMouseEvent': async ({ type, x, y, button = 'left' }) => {
      await p.mouse.move(x, y);
      if (type === 'mousePressed') await p.mouse.down({ button }); else if (type === 'mouseReleased') await p.mouse.up({ button });
    },
    'Input.insertText': async ({ text }) => { await p.keyboard.insertText(text); },
    'Input.dispatchKeyEvent': async ({ type, code }) => { await (type === 'keyUp' ? p.keyboard.up(code) : p.keyboard.down(code)); },
    // (un toque corto, de menos de 300 ms, es un toque de verdad; uno largo, el dedo puesto con eventos de la página)
    'Input.dispatchTouchEvent': async ({ type, touchPoints }) => {
      if (type === 'touchStart') { finger = touchPoints[0]; setTimeout(() => { if (finger && finger.long === undefined) { finger.long = true; touch('start', finger.x, finger.y).catch(() => {}); } }, 300); return; }
      if (!finger) return;
      if (type === 'touchMove') { if (!finger.long) { finger.long = true; await touch('start', finger.x, finger.y); } const p = touchPoints[0]; finger.x = p.x; finger.y = p.y; return touch('move', p.x, p.y); }
      const f = finger; finger = null;
      if (f.long) await touch('end', f.x, f.y); else { f.long = false; await p.touchscreen.tap(f.x, f.y); }
    },
    'Emulation.setDeviceMetricsOverride': async ({ width, height }) => { await p.setViewportSize({ width, height }); },
    'Emulation.clearDeviceMetricsOverride': async () => { await p.setViewportSize({ width: 1280, height: 860 }); },
  };
  const call = async (method, params = {}) => (H[method] ? (await H[method](params)) || {} : {});
  return { call, close: () => browser.close().catch(() => {}) };
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
  const problems = [], requests = [];
  let call, closeBrowser;
  if (process.env.E2E_BROWSER) ({ call, close: closeBrowser } = await playwrightCall(process.env.E2E_BROWSER, problems, requests));
  else {
    const chromePath = findChrome();
    if (!chromePath) throw new Error('No encuentro Chrome/Chromium: instala uno o pon su ruta en CHROME');
    const chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
      `--remote-debugging-port=${dbg}`, `--user-data-dir=${path.join(tmp, 'chrome')}`, '--window-size=1280,860',
      '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
    // (al empezar un trozo del CI arrancan dos Chrome en frío a la vez y alguno pasaba de 10 s: hasta 30)
    let target, exited = null;
    chrome.once('exit', (code, sig) => { exited = code ?? sig; });
    chrome.once('error', e => { exited = e.code; });   // (CHROME que no existe o no se puede ejecutar)
    for (const end = Date.now() + 30e3 * PATIENCE; !target && exited === null && Date.now() < end;) {
      try { target = (await (await fetch(`http://127.0.0.1:${dbg}/json`, { signal: AbortSignal.timeout(2000) })).json()).find(x => x.type === 'page'); } catch {}
      if (!target) await sleep(100);
    }
    if (!target) throw new Error(exited !== null ? `Chrome se ha cerrado al arrancar (${exited})` : 'Chrome no abre la página de depuración');
    const cdp = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => { cdp.on('open', r); cdp.on('error', j); });
    let id = 0;
    const pending = new Map();
    cdp.on('message', raw => {
      const m = JSON.parse(raw);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
      if (m.method === 'Runtime.exceptionThrown') problems.push('JS: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
      if (m.method === 'Log.entryAdded' && /Content Security Policy|Refused to/.test(m.params.entry.text)) problems.push('CSP: ' + m.params.entry.text);
      if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
    });
    call = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); cdp.send(JSON.stringify({ id: i, method, params })); });
    closeBrowser = async () => { try { cdp.close(); } catch {} chrome.kill('SIGKILL'); await gone(chrome); };
  }
  await call('Runtime.enable'); await call('Log.enable'); await call('Page.enable'); await call('Network.enable');
  // E2E_SLOW=4: el navegador va 4 veces más lento, para reproducir aquí lo que solo falla en el CI (máquinas lentas)
  if (+process.env.E2E_SLOW > 1) await call('Emulation.setCPUThrottlingRate', { rate: +process.env.E2E_SLOW });
  // El premio diario se abre solo una vez al día: en las pruebas cuenta como ya visto (si no, taparía la
  // pantalla en todas); la del premio diario lo quita poniendo 'arena.dailySeen' a 'nunca'
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `try { if (!localStorage.getItem('arena.dailySeen')) localStorage.setItem('arena.dailySeen', new Date().toISOString().slice(0, 10)); } catch {}` });

  // En la página: lo que ve el jugador. visto(e) dice por qué no se ve un elemento (o null si se ve): sin tamaño,
  // oculto o transparente, fuera de la ventana (o recortado por un contenedor con scroll) o tapado por otra cosa
  // en su centro. nombre(e) es lo que «lee» el jugador de un botón: su texto, o su aria-label, title o data-tip
  const LOOK = `const norm = s => String(s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const tag = n => n ? n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\\s+/).slice(0, 3).join('.') : '') + (n.textContent ? ' «' + n.textContent.trim().slice(0, 30) + '»' : '') : 'nada';
    const visto = e => {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) return 'no tiene tamaño (no se ve)';
      for (let a = e; a && a.nodeType === 1; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.visibility === 'hidden' || cs.display === 'none') return 'está oculto';
        // (salvo a media animación de entrada: con la máquina cargada, el navegador puede tardar en acabarla)
        if (+cs.opacity < 0.1 && !a.getAnimations().some(x => x.playState === 'running' && x.effect && x.effect.getTiming().iterations !== Infinity)) return 'es transparente';
      }
      let L = Math.max(0, r.left), T = Math.max(0, r.top), R = Math.min(innerWidth, r.right), B = Math.min(innerHeight, r.bottom);
      for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const q = a.getBoundingClientRect(); L = Math.max(L, q.left); T = Math.max(T, q.top); R = Math.min(R, q.right); B = Math.min(B, q.bottom); }
      }
      if (R - L < 2 || B - T < 2) return 'está fuera de la ventana (hay que desplazar para verlo)';
      const hit = () => document.elementFromPoint((L + R) / 2, (T + B) / 2);
      const mine = n => !!n && (n === e || e.contains(n) || n.contains(e) || (e.htmlFor && n.id === e.htmlFor));
      let top = hit();
      // (lo que no recibe el ratón, como el marcador del combate, el punto lo atraviesa: se mira con él recibiéndolo)
      if (!mine(top)) {
        const off = []; for (let a = e; a && a.nodeType === 1; a = a.parentElement) if (getComputedStyle(a).pointerEvents === 'none') { off.push([a, a.style.pointerEvents]); a.style.pointerEvents = 'auto'; }
        if (off.length) { top = hit(); off.forEach(([a, v]) => { a.style.pointerEvents = v; }); }
      }
      if (!mine(top)) return 'está tapado por ' + tag(top);
      return null;
    };
    // (lo que lee el jugador de un botón: su texto, y su aria-label, tooltip o el alt de su imagen: vale cualquiera)
    const crudos = e => [e.getAttribute('aria-label'), e.matches('input') ? e.value : e.innerText, e.title, e.dataset.tip, ...[...e.querySelectorAll('img[alt]')].map(i => i.alt)]
      .filter(Boolean).map(x => String(x).replace(/\\s+/g, ' ').trim()).filter(Boolean);
    const nombre = e => crudos(e).map(norm).join(' | ');
    const sitio = s => { if (!s.startsWith('dentro:')) return document.querySelector(s); const w = JSON.parse(s.slice(7));
      const l = [...document.querySelectorAll(w.sel)].filter(e => norm(e.innerText).includes(norm(w.text)));
      const inner = l.filter(e => !l.some(o => o !== e && e.contains(o))); return inner.length === 1 ? inner[0] : null; };`;
  // Busca, dentro de `scope`, los elementos más pequeños cuyo texto visible (innerText: sin lo oculto) contiene el
  // texto (o cumple la expresión regular); los campos cuentan por lo que tienen escrito
  const FIND_TEXT = (pat, scope) => `(() => { ${LOOK}
    const P = ${JSON.stringify(pat)}, root = ${scope ? `sitio(${JSON.stringify(scope)})` : 'document.body'};
    if (!root) return { err: 'no está ${scope ? 'el sitio donde buscar: ' + String(scope).replace(/'/g, '') : 'la página'}' };
    const match = s => P.re ? new RegExp(P.re, P.fl).test(String(s || '').replace(/\\s+/g, ' ')) : norm(s).includes(norm(P.s));
    const out = [];
    const walk = e => { const kids = [...e.children].filter(k => match(k.innerText)); if (kids.length) kids.forEach(walk); else out.push(e); };
    if (match(root.innerText)) walk(root);
    for (const i of root.querySelectorAll('input, textarea')) if (i.value && match(i.value)) out.push(i);
    return { list: out.map(e => { const why = visto(e); return { why, what: tag(e) }; }) };
  })()`;

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
      ms *= PATIENCE;
      while (Date.now() - t0 < ms) { try { if (await page.eval(`!!(${expr})`)) return; } catch {} await sleep(100); }
      throw new Error(`Tiempo agotado esperando: ${expr}`);
    },
    // Pulsa como un jugador el elemento de un selector CSS (o el primer botón/enlace visible cuyo texto contenga
    // `text`): lo pone a la vista, espera a que se pueda pulsar (dentro de la pantalla, activo y sin nada encima,
    // hasta 3 s: animaciones, ventanas que se abren) y hace un clic de ratón de verdad en su centro. Si algo lo
    // tapa, falla diciendo qué: así se ven los avisos o barras que tapan botones
    async click(textOrSel) {
      const r = await page.locate(textOrSel);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await call('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
      await sleep(150);
    },
    // Dónde pulsar un elemento (su centro) cuando ya se puede: a la vista (lo pone con scrollIntoView: `block`), activo,
    // quieto y sin nada encima; si no, falla diciendo por qué. Lo usan click y el dedo
    async locate(textOrSel, block = 'center') {
      const where = `(() => { const s = ${JSON.stringify(textOrSel)};
        const shown = x => x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden';
        let e = null;
        // (lo que da page.within: el sitio que dice un texto)
        if (s.startsWith('dentro:')) { const w = JSON.parse(s.slice(7)), n = t => String(t || '').replace(/\\s+/g, ' ').trim().toLowerCase();
          const l = [...document.querySelectorAll(w.sel)].filter(x => n(x.innerText).includes(n(w.text))); const inner = l.filter(x => !l.some(o => o !== x && x.contains(o)));
          if (inner.length !== 1) return { err: inner.length ? 'hay ' + inner.length : 'no está' }; e = inner[0]; }
        else try { e = document.querySelector(s); } catch { /* no es un selector: se busca por texto */ }
        if (!e) e = [...document.querySelectorAll('button, a, summary, [role=button]')].find(x => shown(x) && x.textContent.trim().toLowerCase().includes(s.toLowerCase()));
        if (!e) return { err: 'no está' };
        e.scrollIntoView({ behavior: 'instant', block: ${JSON.stringify(block)}, inline: ${JSON.stringify(block)} });   // (sin el suave del Camino, que cada lectura relanzaría y parecería quieto)
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
      // (con la máquina muy cargada una sola lectura puede tardar segundos: siempre unas cuantas, aunque pasen los 4 s;
      // en una máquina más lenta, con E2E_TIMEOUT de más, también se espera más)
      let r = await page.eval(where), prev = null, reads = 1;
      while ((r.err || !prev || prev.x !== r.x || prev.y !== r.y || prev.w !== r.w || prev.h !== r.h) && (Date.now() - t0 < 4000 * PATIENCE || reads < 5)) {
        prev = r.err ? null : r; await sleep(80); reads++;
        if (Date.now() - t0 > 1200) await page.eval('window.__e2eAnimOk = true; true');
        r = await page.eval(where);
      }
      if (r.err) throw new Error(`No se puede pulsar «${textOrSel}»: ${r.err}`);
      return r;
    },
    // (antes era un clic de mentira y este el de verdad; ahora los dos son de verdad)
    async realClick(sel) { await page.click(sel); },
    // ¿Lo ve el jugador? true si el texto (o la expresión regular) está en pantalla: visible, dentro de la ventana
    // (sin desplazar, salvo { scroll: true }) y sin nada encima; espera hasta `ms` (5 s) a que salga. No falla: es
    // para ok(await page.see('…'), '…'); si es false, el ok() dice por qué (tapado, fuera de la ventana…).
    // { in: selector } busca solo dentro de ese sitio (una ventana, una tarjeta)
    async see(text, { in: scope, ms = 5000, scroll = false } = {}) {
      const pat = text instanceof RegExp ? { re: text.source, fl: text.flags } : { s: String(text) };
      const t0 = Date.now();
      ms *= PATIENCE;
      let last = { err: 'no está' };
      for (;;) {
        if (scroll) await page.eval(`(() => { ${LOOK} const P = ${JSON.stringify(pat)}; const match = s => P.re ? new RegExp(P.re, P.fl).test(String(s || '')) : norm(s).includes(norm(P.s));
          const root = ${scope ? `sitio(${JSON.stringify(scope)})` : 'document.body'}; if (!root) return true;
          let e = root; for (;;) { const k = [...e.children].find(k => match(k.innerText)); if (!k) break; e = k; } if (e !== root) e.scrollIntoView({ block: 'center', inline: 'nearest' }); return true; })()`).catch(() => {});
        try { last = await page.eval(FIND_TEXT(pat, scope)); } catch (e) { last = { err: e.message }; }
        if (last.list && last.list.some(x => !x.why)) { page.lastSee = null; return true; }
        if (Date.now() - t0 >= ms) break;
        await sleep(100);
      }
      const why = last.err || (last.list.length ? last.list.slice(0, 3).map(x => `${x.what} ${x.why}`).join('; ') : 'no está en la página');
      page.lastSee = `no se ve «${text}»: ${why}`;
      return false;
    },
    // Como see, pero para esperar: falla si en `ms` (15 s) no se ve
    async waitSee(text, opts = {}) {
      if (!(await page.see(text, { ms: 15000, ...opts }))) throw new Error(page.lastSee);
    },
    // El sitio (de los que cumplen `sel`, p. ej. '.shop-item') que dice `text`, para buscar dentro de él con
    // { in }: page.tap('Comprar', { in: await page.within('Super Ball', '.shop-item') }). El más pequeño si hay
    // varios anidados; falla si no hay ninguno o hay varios distintos. Se vuelve a buscar cada vez que se usa (la
    // pantalla se repinta, p. ej. tras comprar)
    async within(text, sel) {
      const w = 'dentro:' + JSON.stringify({ text: String(text), sel });
      const n = await page.eval(`(() => { ${LOOK} const l = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => norm(e.innerText).includes(norm(${JSON.stringify(String(text))})));
        return l.filter(e => !l.some(o => o !== e && e.contains(o))).length; })()`);
      if (n !== 1) throw new Error(`¿Qué ${sel} dice «${text}»? ${n ? 'hay ' + n : 'no hay ninguno'}`);
      return w;
    },
    // Lo que se lee en un sitio (innerText: solo lo visible), o '' si no está o no se ve; { in } como en see
    async read(sel, { in: scope } = {}) {
      return page.eval(`(() => { ${LOOK} const root = ${scope ? `sitio(${JSON.stringify(scope)})` : 'document'}; const e = root && (root.matches && root.matches(${JSON.stringify(sel)}) ? root : root.querySelector(${JSON.stringify(sel)}));
        return e && e.getClientRects().length ? e.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
    },
    // Pulsa como un jugador el botón (o enlace, pestaña, tarjeta pulsable…) que dice `name`: lo busca por lo que lee
    // el jugador (su texto, o su aria-label o tooltip), primero igual y si no, que lo contenga, y hace un clic de
    // verdad con page.click (que falla si está tapado). Si hay varios que se ven y dicen lo mismo, falla: di cuál con
    // { in: selector } (dentro de qué) o { nth: i }. Con un RegExp, los que lo cumplen
    async tap(name, { in: scope, nth, ms = 10000 } = {}) {
      const pat = name instanceof RegExp ? { re: name.source, fl: name.flags } : { s: String(name) };
      const t0 = Date.now();
      ms *= PATIENCE;
      let r;
      for (;;) {
        r = await page.eval(`(() => { ${LOOK}
          const P = ${JSON.stringify(pat)}, root = ${scope ? `sitio(${JSON.stringify(scope)})` : 'document'};
          if (!root) return { err: 'no está el sitio donde buscar' };
          const CLICKABLE = 'button, a[href], summary, label, select, input[type=button], input[type=submit], input[type=checkbox], input[type=radio], [role=button], [role=tab], [role=link], [role=menuitem], [role=option], [role=switch], [tabindex]';
          const all = [...root.querySelectorAll('*')].filter(e => e.matches(CLICKABLE) || typeof e.onclick === 'function' || typeof e.onpointerdown === 'function');
          const shown = all.filter(e => !visto(e) || /fuera de la ventana/.test(visto(e)));
          const q = norm(P.s), ns = e => crudos(e).map(norm);
          const fits = e => P.re ? crudos(e).some(x => new RegExp(P.re, P.fl).test(x)) : ns(e).some(x => x.includes(q));
          const pick = P.re ? [shown.filter(fits)] : [shown.filter(e => ns(e).some(x => x === q)), shown.filter(e => ns(e).some(x => x.startsWith(q))), shown.filter(fits)];
          // (si uno está dentro de otro que también vale, cuenta el de dentro: el de fuera suele ser una tarjeta o el
          // fondo de una ventana, pulsables y con todo el texto dentro)
          const level = pick.map(l => l.filter(e => !l.some(o => o !== e && e.contains(o)))).find(l => l.length) || [];
          const nth = ${nth === undefined ? 'null' : +nth};
          if (!level.length) { const hidden = all.filter(fits).map(e => tag(e) + ' ' + visto(e)); return { err: hidden.length ? 'no se ve: ' + hidden.slice(0, 2).join('; ') : 'no hay ningún botón que lo diga' }; }
          if (level.length > 1 && nth === null) return { err: 'hay ' + level.length + ' que lo dicen (' + level.slice(0, 3).map(tag).join(', ') + '): di cuál con { in: selector } o { nth }' };
          const e = level[nth || 0];
          if (!e) return { err: 'no hay el n.º ' + nth };
          const id = 'tap' + Math.random().toString(36).slice(2, 8);
          e.setAttribute('data-e2e-tap', id);
          return { sel: '[data-e2e-tap="' + id + '"]' };
        })()`);
        if (r.sel || Date.now() - t0 >= ms) break;
        await sleep(100);
      }
      if (!r.sel) throw new Error(`No se puede pulsar «${name}»: ${r.err}`);
      try { await page.click(r.sel); } finally { await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(r.sel)}); if (e) e.removeAttribute('data-e2e-tap'); return true; })()`).catch(() => {}); }
    },
    // Qué pantalla ve el jugador: el título de la ventana que haya abierta encima (su primer encabezado visible) o,
    // si no hay ninguna, el de la pantalla (el letrero de su barra de arriba: «Tienda», «Mis Pokémon»…; en el menú
    // y en la portada, el logo; en los resultados, «¡Victoria!» o «Derrota»). En combate, sin pantalla delante, ''
    async title({ ms = 3000 } = {}) {
      // (espera un poco a que salga: la pantalla o la ventana pueden estar entrando)
      const t0 = Date.now();
      for (;;) { const t = await page.titleNow(); if (t || Date.now() - t0 > ms * PATIENCE) return t; await sleep(150); }
    },
    async titleNow() {
      return page.eval(`(() => { ${LOOK}
        const seen = e => !visto(e) || /fuera de la ventana/.test(visto(e));
        const tops = [...document.querySelectorAll('body > .modal, body > .loot-pop, body > .mon-sheet-back, body > .ui-confirm')].filter(seen);
        const scope = tops.length ? tops[tops.length - 1] : document.getElementById('screen');
        if (!scope || scope.hidden) return '';
        const h = (tops.length ? [] : [...scope.querySelectorAll('.feature-sign h2')]).concat([...scope.querySelectorAll(tops.length ? 'h1, h2, h3' : 'h1, h2')]).find(seen);
        return h ? h.innerText.replace(/\\s+/g, ' ').trim() : '';
      })()`);
    },
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
      // (solo se desplaza si no está a la vista, como haría el jugador: desplazar justo antes del toque dispara un
      // scroll que esconde lo que el toque acaba de abrir, y tapaba fallos como un tooltip que se queda pegado; y como
      // el clic, falla si no se ve o algo lo tapa: un toque que no llega a su sitio no prueba nada)
      const r = await page.locate(sel, 'nearest');
      await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] });
    },
    // Una tecla de verdad (del teclado del navegador, no un evento inventado): `code` como en KeyboardEvent.code
    // ('Escape', 'KeyD', 'Digit2', 'Space', 'Enter'…), pulsada `ms` milisegundos
    async key(code, ms = 60) {
      const k = KEYS[code] || (/^Key([A-Z])$/.test(code) ? [code.slice(3).toLowerCase(), code.charCodeAt(3)] : /^Digit(\d)$/.test(code) ? [code.slice(5), 48 + +code.slice(5)] : null);
      if (!k) throw new Error('Tecla desconocida: ' + code);
      const base = { code, key: k[0], windowsVirtualKeyCode: k[1], nativeVirtualKeyCode: k[1] };
      // (con texto, como una letra o Intro, «keyDown» lleva su carácter: así Intro envía el formulario)
      const text = k[2] || (k[0].length === 1 ? k[0] : '');
      await call('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? { text, unmodifiedText: text } : {}) });
      await sleep(ms);
      await call('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },
    // El ratón de verdad en un punto de la pantalla (p. ej. apuntar en la arena 3D, que no tiene elementos):
    // mouseAt(x, y) lo mueve; con { click: true } además pulsa (botón izquierdo, o 'right')
    // Arrastrar con el ratón, por pasos, como una mano
    async mouseDrag(x0, y0, x1, y1) {
      await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
      await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
      for (let i = 1; i <= 8; i++) await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / 8, y: y0 + (y1 - y0) * i / 8 });
      await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
      await sleep(150);
    },
    async mouseAt(x, y, { click = false, button = 'left' } = {}) {
      await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      if (click) for (const type of ['mousePressed', 'mouseReleased']) await call('Input.dispatchMouseEvent', { type, x, y, button, clickCount: 1 });
    },
    // El dedo en un punto de la pantalla (fingerAt) y arrastrándolo (fingerMove): el joystick, apuntar un movimiento
    async fingerAt(x, y) { await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); },
    async fingerMove(x, y) { await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await sleep(50); },
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
  const teardown = async () => {
    server.kill('SIGKILL');
    await Promise.all([closeBrowser(), gone(server)]);
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
  // (si un ok() falla justo después de un page.see que no vio algo, dice qué no se veía y por qué)
  const t = { ok: (cond, msg) => {
    const why = !cond && ctx && ctx.page.lastSee;
    if (ctx) ctx.page.lastSee = null;
    results.push([!!cond, msg]); out.push(`  ${cond ? '✓' : '✗'} ${msg}${why ? `\n      (${why})` : ''}`);
  }, log: msg => out.push('    ' + msg) };
  try {
    const test = require(path.resolve(file));
    ctx = await setup(name, test.env);
    Object.assign(t, ctx);
    // Como mucho 5 minutos por prueba (con varias a la vez y el 3D por software del CI van más lentas): un test
    // colgado no bloquea el CI. En una máquina más lenta, E2E_TIMEOUT=segundos
    const limit = +process.env.E2E_TIMEOUT || 300;
    await Promise.race([test(t),
      new Promise((_, j) => setTimeout(() => j(new Error(`más de ${limit / 60} minutos: algo se ha quedado esperando`)), limit * 1e3).unref())]);
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
