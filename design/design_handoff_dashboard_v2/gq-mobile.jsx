/* G-Quota — pantallas móvil (V1 panorámica · V2 operativa) */

function MHeader() {
  return (
    <header className="gqm-header">
      <div>
        <h1>Hola, Marcela 👋</h1>
        <p>Martes, 3 de junio</p>
      </div>
      <div className="gqm-head-actions">
        <button className="gqm-iconbtn" aria-label="Notificaciones">{I.bell}<span className="gq-dot"></span></button>
        <button className="gqm-iconbtn" aria-label="Configuración">{I.gear}</button>
      </div>
    </header>
  );
}

function MMetric({ label, value, valueClass = '', chip, icon, sub }) {
  return (
    <div className="gqm-metric">
      <div className="top">
        <span className="lbl">{label}</span>
        <span className={'gqm-chip gq-chip ' + chip}>{icon}</span>
      </div>
      <div className={'val mono ' + valueClass}>{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

// ════════════════════ V1 móvil — Panorámica ════════════════════
function MobileV1() {
  return (
    <div className="gqm">
      <StatusBar />
      <MHeader />
      <div className="gqm-body">
        <div className="gqm-metrics">
          <MMetric label="Total prestado"  chip="green" icon={I.wallet} value={cop(48500000)} sub="32 activos" />
          <MMetric label="Saldo por cobrar" chip="slate" icon={I.cash}  value={cop(31200000)} sub="28 clientes" />
          <MMetric label="Ganancia mes"     chip="amber" icon={I.wallet} valueClass="amber" value={cop(4350000)} sub="intereses · junio" />
          <MMetric label="En mora"          chip="red"   icon={I.alert} valueClass="red"   value={cop(6800000)} sub="5 vencidos" />
        </div>

        <div>
          <div className="gqm-sec-head" style={{ marginBottom: 9 }}>
            <h2>Cobros de hoy</h2>
            <a className="gq-link" href="#">Ver todos {I.arrow}</a>
          </div>
          <div className="gqm-card">
            {COBROS_HOY.slice(0, 3).map((c, i) => (
              <div className="gqm-row" key={i}>
                <Avatar name={c.name} color={c.color} />
                <div className="gqm-row-meta">
                  <div className="gqm-row-name">{c.name}</div>
                  <div className="gqm-row-sub">{c.phone}</div>
                </div>
                <div className="gqm-row-right">
                  <span className="amt mono">{cop(c.amount)}</span>
                </div>
                <button style={{ width: 44, height: 44, flex: '0 0 44px', borderRadius: 13, background: 'var(--green-tint)', color: 'var(--green-700)', display: 'grid', placeItems: 'center' }}>
                  <span style={{ width: 20, height: 20 }}>{I.cash}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="gqm-sec-head" style={{ marginBottom: 9 }}>
            <h2>Top deudores</h2>
            <a className="gq-link" href="#">Ver todos {I.arrow}</a>
          </div>
          <div className="gqm-card">
            {DEUDORES.slice(0, 2).map((d, i) => (
              <div className="gqm-row" key={i}>
                <Avatar name={d.name} color={d.color} />
                <div className="gqm-row-meta">
                  <div className="gqm-row-name">{d.name}</div>
                  <div className="gqm-row-sub">Saldo pendiente</div>
                </div>
                <div className="gqm-row-right">
                  <span className="amt mono">{cop(d.saldo)}</span>
                  <Badge estado={d.estado} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button className="gqm-fab">{I.plus}Nuevo préstamo</button>
      <BottomNav active="inicio" />
    </div>
  );
}

// ════════════════════ V2 móvil — Operativa del día ════════════════════
function MStat({ color, label, value, valueClass = '', sub, w = 128, tint, border }) {
  return (
    <div className="gqm-stat" style={{ minWidth: w, flex: '0 0 ' + w + 'px', scrollSnapAlign: 'start', background: tint || undefined, borderColor: border || undefined }}>
      <span className="lbl" style={{ whiteSpace: 'nowrap' }}><span className="ic" style={{ background: color }}></span>{label}</span>
      <span className={'val mono ' + valueClass} style={{ fontSize: 13.5, whiteSpace: 'nowrap' }}>{value}</span>
      <span className="gqm-row-sub" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{sub}</span>
    </div>
  );
}

function MobileV2() {
  const total = COBROS_HOY.reduce((s, c) => s + c.amount, 0);
  const cobrados = COBROS_HOY.filter((c) => c.paid).length;
  const pct = Math.round((cobrados / COBROS_HOY.length) * 100);
  return (
    <div className="gqm">
      <StatusBar />
      <MHeader />
      <div className="gqm-body" style={{ gap: 14 }}>
        {/* franja secundaria: 3 deslizables + "En mora" fija a la derecha (métrica de alerta siempre visible) */}
        <div style={{ marginLeft: -18, marginRight: -18, padding: '2px 18px 4px', display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <div className="gqm-statbar" style={{ overflowX: 'auto', scrollSnapType: 'x proximity', gap: 8 }}>
              <MStat color="#047857" label="Prestado"   value={cop(48500000)} sub="32 activos" />
              <MStat color="#3f5b50" label="Por cobrar" value={cop(31200000)} sub="28 clientes" />
              <MStat color="#d97706" label="Ganancia"   value={cop(4350000)} valueClass="amber" sub="junio" />
            </div>
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 22, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(250,249,247,0), var(--bg))' }}></div>
          </div>
          <MStat color="#dc2626" label="En mora" value={cop(6800000)} valueClass="red" sub="5 vencidos" w={108} tint="var(--red-tint)" border="var(--red-tint-2)" />
        </div>

        {/* protagonista */}
        <div className="gqm-card">
          <div style={{ padding: '15px 16px 13px', borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em' }}>Cobros de hoy</h2>
              <span className="gq-count">{cobrados} de {COBROS_HOY.length}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500, margin: '6px 0 10px' }}>
              <Mono className="">{cop(total)}</Mono> por cobrar hoy
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="gq-bar" style={{ flex: 1, display: 'block' }}><i style={{ width: pct + '%' }}></i></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap' }}><b style={{ color: 'var(--green-700)' }}>{cobrados}</b> de {COBROS_HOY.length} cobrados</span>
            </div>
          </div>
          <div style={{ padding: '11px 16px 3px', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>Pendientes · {COBROS_HOY.length - cobrados}</div>
          {COBROS_HOY.filter((c) => !c.paid).slice(0, 3).map((c, i) => (
            <div className="gqm-cobro" key={i}>
              <div className="gqm-cobro-top">
                <Avatar name={c.name} color={c.color} />
                <div className="gqm-row-meta">
                  <div className="gqm-row-name">{c.name}</div>
                  <div className="gqm-row-sub">{c.phone} · {c.due}</div>
                </div>
                <div className="gqm-cobro-amt">
                  <div className="amt mono">{cop(c.amount)}</div>
                  <div className="lbl">a cobrar</div>
                </div>
              </div>
              <button className="gqm-pay">{I.cash} Registrar pago</button>
            </div>
          ))}
        </div>
      </div>

      <BottomNav active="cobros" />
    </div>
  );
}

Object.assign(window, { MobileV1, MobileV2 });
