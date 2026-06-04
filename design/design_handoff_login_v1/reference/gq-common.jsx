/* G-Quota — datos, iconos y componentes compartidos */

// ── Formato de moneda COP sin decimales: $1.000.000 ──
function cop(n) {
  const s = Math.abs(Math.round(n)).toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += '.';
    out += s[i];
  }
  return (n < 0 ? '-$' : '$') + out;
}
function Mono({ children, className = '' }) {
  return <span className={'mono ' + className}>{children}</span>;
}

// ── Iconos de línea (stroke) ──
const I = {
  home:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5.5h5V20"/></svg>,
  users:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.9-4.5 5.5-4.5S13.9 16 14.5 19"/><path d="M16 5.2A3 3 0 0118 11M21 19c-.4-2.2-1.6-3.6-3.3-4.2"/></svg>,
  loan:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>,
  cash:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v0M18 14.5v0"/></svg>,
  gear:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4L5.6 5.6"/></svg>,
  plus:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  bell:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 004 0"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>,
  arrow:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  check:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>,
  wallet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.5A2.5 2.5 0 015.5 5H18a2 2 0 012 2v0H5.5"/><path d="M3 7.5V18a2 2 0 002 2h14a1.5 1.5 0 001.5-1.5V10A1.5 1.5 0 0019 8.5H5"/><circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none"/></svg>,
  clock:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>,
  alert:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9.5 16.5H2.5L12 3Z"/><path d="M12 10v4M12 17v0"/></svg>,
  phone:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2Z"/></svg>,
};

// iniciales a partir del nombre
function initials(name) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}
function Avatar({ name, color, className = '' }) {
  return <div className={'gq-ava av-' + color + ' ' + className}>{initials(name)}</div>;
}

const ESTADO = {
  aldia:   { cls: 'aldia',   txt: 'Al día' },
  porvenc: { cls: 'porvenc', txt: 'Por vencer' },
  vencido: { cls: 'vencido', txt: 'Vencido' },
};
function Badge({ estado }) {
  const e = ESTADO[estado];
  return <span className={'gq-badge ' + e.cls}>{e.txt}</span>;
}

// ── Datos de ejemplo ──
const COBROS_HOY = [
  { name: 'Carlos Restrepo',     phone: '310 555 1234', amount: 250000, color: 1, due: 'Cuota 4 de 12',  paid: false },
  { name: 'Luz Mariana Gómez',   phone: '320 555 8899', amount: 180000, color: 5, due: 'Cuota 7 de 10',  paid: false },
  { name: 'Édinson Quintero',    phone: '301 555 4521', amount: 420000, color: 3, due: 'Cuota 2 de 8',   paid: false },
  { name: 'Yuly Andrea Parra',   phone: '315 555 7710', amount: 95000,  color: 6, due: 'Cuota 9 de 12',  paid: true  },
  { name: 'Néstor Villa',        phone: '318 555 2096', amount: 270000, color: 7, due: 'Cuota 1 de 6',   paid: true  },
];

const DEUDORES = [
  { name: 'Jhon Fredy Lopera',    phone: '311 555 9080', saldo: 2400000, estado: 'aldia',   color: 2 },
  { name: 'Sandra Milena Ortiz',  phone: '300 555 3344', saldo: 1850000, estado: 'porvenc', color: 8 },
  { name: 'Wilson Castaño',       phone: '312 555 6677', saldo: 980000,  estado: 'vencido', color: 7 },
  { name: 'Diana Restrepo',       phone: '316 555 1290', saldo: 3200000, estado: 'aldia',   color: 4 },
  { name: 'Brayan Stiven Mejía',  phone: '319 555 4408', saldo: 640000,  estado: 'porvenc', color: 3 },
];

const NAV = [
  { id: 'inicio',  label: 'Inicio',        icon: I.home },
  { id: 'clientes',label: 'Clientes',      icon: I.users },
  { id: 'prestamos',label: 'Préstamos',    icon: I.loan },
  { id: 'cobros',  label: 'Cobros',        icon: I.cash },
  { id: 'config',  label: 'Configuración', icon: I.gear },
];

// ── Sidebar desktop ──
function Sidebar() {
  return (
    <aside className="gq-side">
      <div className="gq-brand">
        <div className="gq-brand-mark">G</div>
        <div className="gq-brand-name">G<span>·</span>Quota</div>
      </div>
      <nav className="gq-nav">
        <div className="gq-nav-label">Menú</div>
        {NAV.map((n) => (
          <button key={n.id} className={'gq-nav-item' + (n.id === 'inicio' ? ' is-active' : '')}>
            {n.icon}<span>{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="gq-side-foot">
        <div className="gq-user">
          <div className="gq-ava">MR</div>
          <div className="gq-user-meta">
            <div className="gq-user-name">Marcela Ríos</div>
            <div className="gq-user-role">Prestamista</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── Topbar desktop ──
function Topbar() {
  return (
    <div className="gq-topbar">
      <div className="gq-greet">
        <h1>Hola, Marcela 👋</h1>
        <p>Martes, 3 de junio · Tienes <b style={{color:'var(--amber)'}}>5 cobros</b> programados para hoy</p>
      </div>
      <div className="gq-topbar-actions">
        <button className="gq-iconbtn" aria-label="Buscar">{I.search}</button>
        <button className="gq-iconbtn" aria-label="Notificaciones">{I.bell}<span className="gq-dot"></span></button>
        <button className="gq-btn">{I.plus}<span>Nuevo préstamo</span></button>
      </div>
    </div>
  );
}

// ── Bottom nav móvil (4 principales) ──
const NAV_M = NAV.filter((n) => n.id !== 'config');
function BottomNav({ active = 'inicio' }) {
  return (
    <nav className="gqm-nav">
      {NAV_M.map((n) => (
        <button key={n.id} className={'gqm-nav-item' + (n.id === active ? ' is-active' : '')}>
          {n.icon}<span>{n.label}</span>
        </button>
      ))}
    </nav>
  );
}

// barra de estado móvil
function StatusBar() {
  return (
    <div className="gqm-status">
      <span className="mono">9:41</span>
      <span className="dots">
        <svg viewBox="0 0 18 13" fill="currentColor"><rect x="0" y="8" width="3" height="5" rx="1"/><rect x="5" y="5" width="3" height="8" rx="1"/><rect x="10" y="2" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="13" rx="1" opacity=".35"/></svg>
        <svg viewBox="0 0 24 13" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="20" height="11" rx="3"/><rect x="3" y="3" width="14" height="7" rx="1.5" fill="currentColor" stroke="none"/><rect x="22" y="4.5" width="1.5" height="4" rx="1" fill="currentColor" stroke="none"/></svg>
      </span>
    </div>
  );
}

Object.assign(window, {
  cop, Mono, I, Avatar, Badge, initials,
  COBROS_HOY, DEUDORES, NAV, NAV_M,
  Sidebar, Topbar, BottomNav, StatusBar,
});
