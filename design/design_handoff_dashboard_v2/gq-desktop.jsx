/* G-Quota — pantallas desktop (V1 panorámica · V2 operativa) */

// ── Tarjeta de métrica (V1) ──
function MetricCard({ label, value, valueClass = '', chip, icon, sub }) {
  return (
    <div className="gq-metric">
      <div className="gq-metric-top">
        <span className="gq-metric-label">{label}</span>
        <span className={'gq-chip ' + chip}>{icon}</span>
      </div>
      <div className={'gq-metric-val mono ' + valueClass}>{value}</div>
      <div className="gq-metric-sub">{sub}</div>
    </div>
  );
}

function Metrics() {
  return (
    <div className="gq-metrics">
      <MetricCard label="Total prestado" chip="green" icon={I.wallet}
        value={cop(48500000)}
        sub={<><b>32</b> préstamos activos</>} />
      <MetricCard label="Saldo por cobrar" chip="slate" icon={I.cash}
        value={cop(31200000)}
        sub={<>en <b>28</b> clientes</>} />
      <MetricCard label="Ganancia del mes" chip="amber" icon={I.wallet} valueClass="amber"
        value={cop(4350000)}
        sub={<>intereses cobrados en junio</>} />
      <MetricCard label="Préstamos en mora" chip="red" icon={I.alert} valueClass="red"
        value={cop(6800000)}
        sub={<span className="gq-pill">5 vencidos</span>} />
    </div>
  );
}

// ── Fila de cobro de hoy (con acción) ──
function CobroRow({ c, big = false }) {
  return (
    <div className={'gq-row' + (big ? ' gq-row-lg' : '')}>
      <Avatar name={c.name} color={c.color} />
      <div className="gq-row-meta">
        <div className="gq-row-name">{c.name}</div>
        <div className="gq-row-sub">{c.phone}<span>·</span>{c.due}</div>
      </div>
      <div className="gq-row-amt" style={{ marginRight: 4 }}>
        <div className="amt mono">{cop(c.amount)}</div>
        <div className="lbl">a cobrar</div>
      </div>
      {c.paid
        ? <span className="gq-paid">{I.check} Cobrado</span>
        : <button className="gq-btn gq-btn-ghost gq-btn-sm">{I.cash}Registrar pago</button>}
    </div>
  );
}

// ── Fila de deudor (con badge) ──
function DeudorRow({ d }) {
  return (
    <div className="gq-row">
      <Avatar name={d.name} color={d.color} />
      <div className="gq-row-meta">
        <div className="gq-row-name">{d.name}</div>
        <div className="gq-row-sub">Saldo pendiente</div>
      </div>
      <div className="gq-row-amt" style={{ marginRight: 12 }}>
        <div className="amt mono">{cop(d.saldo)}</div>
      </div>
      <Badge estado={d.estado} />
    </div>
  );
}

function PanelHead({ title, count, icon }) {
  return (
    <div className="gq-panel-head">
      <div className="gq-panel-title">
        <h2>{title}</h2>
        {count != null && <span className="gq-count">{count}</span>}
      </div>
      <a className="gq-link" href="#">Ver todos {I.arrow}</a>
    </div>
  );
}

// ════════════════════ V1 — Panorámica de cartera ════════════════════
function DashboardV1() {
  return (
    <div className="gq">
      <div className="gq-app">
        <Sidebar />
        <main className="gq-main">
          <Topbar />
          <div className="gq-scroll">
            <Metrics />
            <div className="gq-grid-2" style={{ gridTemplateColumns: '1.45fr 1fr' }}>
              <section className="gq-panel">
                <PanelHead title="Cobros de hoy" count="5" />
                {COBROS_HOY.map((c, i) => <CobroRow key={i} c={c} />)}
              </section>
              <section className="gq-panel">
                <PanelHead title="Top deudores" count="32 activos" />
                {DEUDORES.map((d, i) => <DeudorRow key={i} d={d} />)}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ════════════════════ V2 — Operativa del día ════════════════════
function StatBar() {
  const Stat = ({ color, label, value, valueClass = '', sub }) => (
    <div className="gq-stat">
      <span className="gq-stat-label"><span className="gq-stat-ic" style={{ background: color }}></span>{label}</span>
      <span className={'gq-stat-val mono ' + valueClass}>{value}</span>
      {sub && <span className="gq-stat-sub">{sub}</span>}
    </div>
  );
  return (
    <div className="gq-statbar">
      <Stat color="#047857" label="Total prestado"   value={cop(48500000)} sub="32 préstamos activos" />
      <Stat color="#3f5b50" label="Saldo por cobrar"  value={cop(31200000)} sub="en 28 clientes" />
      <Stat color="#d97706" label="Ganancia del mes"  value={cop(4350000)} valueClass="amber" sub="intereses · junio" />
      <Stat color="#dc2626" label="Préstamos en mora" value={cop(6800000)}  valueClass="red"   sub="5 préstamos vencidos" />
    </div>
  );
}

function DashboardV2() {
  const pendientes = COBROS_HOY.filter((c) => !c.paid);
  const total = COBROS_HOY.reduce((s, c) => s + c.amount, 0);
  const cobrados = COBROS_HOY.filter((c) => c.paid).length;
  const pct = Math.round((cobrados / COBROS_HOY.length) * 100);
  return (
    <div className="gq">
      <div className="gq-app">
        <Sidebar />
        <main className="gq-main">
          <Topbar />
          <div className="gq-scroll">
            <StatBar />
            <div className="gq-grid-2" style={{ gridTemplateColumns: '1.55fr 1fr', marginTop: 18 }}>
              {/* protagonista */}
              <section className="gq-panel">
                <div className="gq-hero-head">
                  <div>
                    <h2>Cobros de hoy</h2>
                    <div className="gq-hero-sub">Martes, 3 de junio · 5 programados · <Mono>{cop(total)}</Mono> por cobrar</div>
                  </div>
                  <div className="gq-progress">
                    <span className="gq-progress-num"><b>{cobrados}</b> de {COBROS_HOY.length} cobrados</span>
                    <span className="gq-bar"><i style={{ width: pct + '%' }}></i></span>
                  </div>
                </div>
                {COBROS_HOY.map((c, i) => <CobroRow key={i} c={c} big />)}
              </section>
              {/* secundario */}
              <section className="gq-panel">
                <PanelHead title="Top deudores" count="32 activos" />
                {DEUDORES.map((d, i) => <DeudorRow key={i} d={d} />)}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardV1, DashboardV2, MetricCard, Metrics, CobroRow, DeudorRow, PanelHead, StatBar });
