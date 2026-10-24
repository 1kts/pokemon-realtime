// Conexión con el servidor: WebSocket con reconexión y el token del perfil en localStorage.
const TOKEN_KEY = 'arena.token', NAME_KEY = 'arena.name';

export const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: se juega igual */ } },
};

export class Net {
  constructor() {
    this.handlers = new Map();
    this.ws = null;
    this.rtt = 0;
    this.closedByUs = false;
  }

  on(type, fn) { this.handlers.set(type, fn); }

  connect(name) {
    this.name = name;
    storage.set(NAME_KEY, name);
    this.open();
  }

  open() {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    this.ws = ws;
    ws.onopen = () => {
      this.send({ t: 'hello', token: storage.get(TOKEN_KEY), name: this.name });
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 2000);
      this.emit({ t: 'connected' });
    };
    ws.onmessage = e => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'pong') { const r = performance.now() - msg.ts; this.rtt = this.rtt ? this.rtt * 0.7 + r * 0.3 : r; return; }
      if (msg.t === 'profile' && msg.p && msg.p.token) storage.set(TOKEN_KEY, msg.p.token);
      this.emit(msg);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      this.emit({ t: 'disconnected' });
      if (!this.closedByUs) setTimeout(() => this.open(), 1500);
    };
  }

  emit(msg) {
    const fn = this.handlers.get(msg.t);
    if (fn) fn(msg);
    const any = this.handlers.get('*');
    if (any) any(msg);
  }

  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }

  static savedName() { return storage.get(NAME_KEY) || ''; }
}
