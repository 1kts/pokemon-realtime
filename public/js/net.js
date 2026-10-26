// Conexión con el servidor: WebSocket con reconexión y el token del perfil en localStorage.
const TOKEN_KEY = 'arena.token', NAME_KEY = 'arena.name';

export const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: se juega igual */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nada que borrar */ } },
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
    if (name) storage.set(NAME_KEY, name);
    this.joined = true;
    this.closedByUs = false;
    // Con la conexión ya abierta (p. ej. tras pedir un código por correo desde la portada) no se abre otra
    if (this.ws && this.ws.readyState === 1) return this.send({ t: 'hello', token: storage.get(TOKEN_KEY), name });
    if (!this.ws || this.ws.readyState > 1) this.open();
  }

  // Iniciar sesión o registrarse ({ t: 'login' | 'register', user, pass }, o con Google o el correo:
  // 'google', 'mailcode', 'mailverify'). Sin conexión abierta,
  // se conecta y lo manda en lugar del saludo con token.
  auth(msg) {
    if (this.ws && this.ws.readyState === 1) return this.send(msg);
    this.pendingAuth = msg;
    if (!this.ws || this.ws.readyState > 1) { this.closedByUs = false; this.open(); }
  }

  // Cerrar sesión: olvidar el token y desconectar
  logout() {
    storage.del(TOKEN_KEY);
    this.joined = false;
    this.closedByUs = true;
    if (this.ws) this.ws.close();
    this.ws = null;
  }

  open() {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    this.ws = ws;
    ws.onopen = () => {
      if (this.pendingAuth) { this.send(this.pendingAuth); this.pendingAuth = null; }
      // Tras un login fallido no hay que crear un invitado al reconectar
      else if (this.joined) this.send({ t: 'hello', token: storage.get(TOKEN_KEY), name: this.name });
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 2000);
      this.emit({ t: 'connected' });
    };
    ws.onmessage = e => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'pong') { const r = performance.now() - msg.ts; this.rtt = this.rtt ? this.rtt * 0.7 + r * 0.3 : r; return; }
      if (msg.t === 'profile' && msg.p && msg.p.token) { storage.set(TOKEN_KEY, msg.p.token); storage.set(NAME_KEY, msg.p.name); this.joined = true; }
      if (msg.t === 'welcome') this.serverVersion = msg.version;
      // Cuenta suspendida: el servidor cierra y no hay que reconectar
      if (msg.t === 'banned') this.closedByUs = true;
      this.emit(msg);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
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
  static hasSession() { return !!storage.get(TOKEN_KEY); }
  static token() { return storage.get(TOKEN_KEY); }
}
