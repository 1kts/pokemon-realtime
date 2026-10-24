// Vigilante externo de PokéArenas: un Cloudflare Worker (plan gratuito) que cada minuto comprueba
// https://pokearenas.com/healthz desde fuera de Hetzner y avisa por Telegram cuando el juego se cae
// y cuando vuelve (solo al cambiar de estado). Si una comprobación falla, repite a los 20 s antes de
// dar la alarma, para no avisar por un tropiezo de red. El estado se guarda en Workers KV y solo se
// escribe al cambiar (el plan gratuito permite 1.000 escrituras al día).
// Despliegue y secretos: ver deploy/README.md («Vigilancia»).

const TIMEOUT_MS = 10000, RETRY_MS = 20000, SLOW_MS = 3000;

// Una comprobación: { ok, ms, detail }
async function probe(url) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'PokeArenas-vigilante' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const ms = Date.now() - t0;
    if (!r.ok) return { ok: false, ms, detail: `HTTP ${r.status}` };
    const j = await r.json();
    return j.ok ? { ok: true, ms, detail: `v${j.version} · ${j.players} conectados` } : { ok: false, ms, detail: 'healthz sin ok' };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, detail: e.name === 'TimeoutError' ? `sin respuesta en ${TIMEOUT_MS / 1000} s` : e.message };
  }
}

async function telegram(env, text) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT, text, disable_web_page_preview: true }),
  });
  if (!r.ok) console.log('Telegram:', r.status, await r.text());
}

const mins = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };

async function check(env) {
  let res = await probe(env.URL);
  if (!res.ok) { await new Promise(r => setTimeout(r, RETRY_MS)); res = await probe(env.URL); }
  const prev = JSON.parse((await env.STATE.get('state')) || '{"down":false}');
  if (!res.ok && !prev.down) {
    await env.STATE.put('state', JSON.stringify({ down: true, since: Date.now(), detail: res.detail }));
    await telegram(env, `🔴 PokéArenas no responde\n${env.URL}\n${res.detail}`);
  } else if (res.ok && prev.down) {
    await env.STATE.put('state', JSON.stringify({ down: false }));
    await telegram(env, `🟢 PokéArenas ha vuelto (caído ${mins(Date.now() - prev.since)})\n${res.detail} · ${res.ms} ms`);
  } else if (res.ok && res.ms > SLOW_MS) {
    console.log(`Lento: ${res.ms} ms`);
  }
  return res;
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(check(env)); },
  // Visitar la dirección del Worker hace una comprobación al momento (sin datos sensibles)
  async fetch(request, env) {
    const res = await check(env);
    return new Response(JSON.stringify({ ok: res.ok, ms: res.ms, detail: res.detail }), { headers: { 'Content-Type': 'application/json' } });
  },
};
