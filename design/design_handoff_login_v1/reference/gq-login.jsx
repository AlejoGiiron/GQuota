/* G-Quota — Login (ingreso): logo, formulario y las 3 pantallas */

// ── Iconos propios del login ──
const LI = {
  mail: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 5.5L20 7"/></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M10.6 10.7a2 2 0 002.8 2.8"/><path d="M9.4 5.8A9.3 9.3 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-2.4 3.2M6.2 7.2A16 16 0 002.5 12S6 18.5 12 18.5a8.7 8.7 0 003-.5"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"/><path d="M9 12l2 2 4-4"/></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16v0"/></svg>,
};

// ── Logo: cuadro ámbar + nombre G·Quota ──
function Logo({ size = 'lg', theme = 'light' }) {
  return (
    <div className={'lg-logo lg-logo--' + theme}>
      <div className={'lg-mark ' + size}>G</div>
      <div className={'lg-word' + (size === 'md' ? ' md' : '')}>G<span className="dot">·</span>Quota</div>
    </div>
  );
}

// ── Formulario de ingreso (interactivo: mostrar/ocultar contraseña) ──
function LoginForm({ center = false, showError = false }) {
  const [show, setShow] = React.useState(false);
  const [email, setEmail] = React.useState(showError ? 'marcela.rios@correo.com' : '');
  const [pwd, setPwd] = React.useState(showError ? 'claveincorrecta' : '');
  const [err, setErr] = React.useState(showError);

  const submit = (e) => {
    e.preventDefault();
    // Demostración: credenciales inválidas → estado de error en español
    setErr(true);
  };

  return (
    <form className="lg-form" onSubmit={submit}>
      <div className={'lg-form-head' + (center ? ' center' : '')}>
        <div className="lg-h1">Iniciar sesión</div>
        <p>Qué bueno verte de nuevo. Ingresa para ver tus cobros de hoy.</p>
      </div>

      {err && (
        <div className="lg-alert" role="alert">
          <span className="ic">{LI.alert}</span>
          <p>Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.</p>
        </div>
      )}

      <div className="lg-fields">
        <div className="lg-field">
          <label className="lg-label" htmlFor="lg-email">Correo electrónico</label>
          <div className="lg-input-wrap">
            <span className="lg-input-ic">{LI.mail}</span>
            <input id="lg-email" type="email" autoComplete="email"
              className={'lg-input' + (err ? ' is-error' : '')}
              placeholder="tucorreo@ejemplo.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="lg-field">
          <div className="lg-field-top">
            <label className="lg-label" htmlFor="lg-pwd">Contraseña</label>
            <a className="lg-forgot" href="#">¿Olvidaste tu contraseña?</a>
          </div>
          <div className="lg-input-wrap">
            <span className="lg-input-ic">{LI.lock}</span>
            <input id="lg-pwd" type={show ? 'text' : 'password'} autoComplete="current-password"
              className={'lg-input pwd' + (err ? ' is-error' : '')}
              placeholder="Tu contraseña"
              value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <button type="button" className="lg-eye" onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {show ? LI.eyeOff : LI.eye}
            </button>
          </div>
        </div>
      </div>

      <button type="submit" className="lg-submit">
        Iniciar sesión {LI.arrow}
      </button>

      <div className="lg-alt">
        ¿No tienes cuenta? <a href="#">Crear cuenta</a>
      </div>

      <div className="lg-secure">{LI.shield} Conexión segura · tus datos están protegidos</div>
    </form>
  );
}

// ── V1 · Pantalla dividida ──
function LoginV1() {
  return (
    <div className="lg gq">
      <div className="lg-brand">
        <Logo size="lg" theme="dark" />
        <div className="lg-brand-body">
          <div className="lg-brand-eyebrow">Gestión de préstamos</div>
          <div className="lg-brand-head">Tu cartera, <em>ordenada</em> y bajo control.</div>
          <p className="lg-brand-sub">Clientes, cuotas y los cobros del día en un solo lugar. Sin cuadernos, sin enredos.</p>
          <div className="lg-brand-points">
            <div className="lg-brand-point"><span className="tick">{LI.shield && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>}</span>Cobros del día siempre a la mano</div>
            <div className="lg-brand-point"><span className="tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>Alertas de cuotas por vencer y en mora</div>
            <div className="lg-brand-point"><span className="tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>Tu ganancia del mes, clara y al instante</div>
          </div>
        </div>
        <div className="lg-brand-foot">© 2026 G-Quota · Hecho en Colombia 🇨🇴</div>
      </div>
      <div className="lg-formside">
        <LoginForm showError={true} />
      </div>
    </div>
  );
}

// ── V2 · Tarjeta centrada minimalista ──
function LoginV2() {
  return (
    <div className="lg gq lg-center">
      <div className="lg-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 30 }}>
          <Logo size="md" theme="light" />
        </div>
        <LoginForm center={true} />
      </div>
    </div>
  );
}

// ── Móvil (390 px) ──
function MobileLogin({ showError = false }) {
  return (
    <div className="lgm gq">
      <StatusBar />
      <div className="lgm-body">
        <div className="lgm-logo-area">
          <Logo size="md" theme="light" />
          <div className="lg-h1">Iniciar sesión</div>
          <p>Qué bueno verte de nuevo. Ingresa<br />para ver tus cobros de hoy.</p>
        </div>
        <MobileForm showError={showError} />
        <div className="lgm-foot">
          <div className="lg-secure" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>{LI.shield} Conexión segura</div>
        </div>
      </div>
    </div>
  );
}

// formulario móvil (sin encabezado propio; ya va arriba)
function MobileForm({ showError = false }) {
  const [show, setShow] = React.useState(false);
  const [email, setEmail] = React.useState(showError ? 'marcela.rios@correo.com' : '');
  const [pwd, setPwd] = React.useState(showError ? 'claveincorrecta' : '');
  const [err, setErr] = React.useState(showError);

  return (
    <form className="lg-form" onSubmit={(e) => { e.preventDefault(); setErr(true); }}>
      {err && (
        <div className="lg-alert" role="alert">
          <span className="ic">{LI.alert}</span>
          <p>Correo o contraseña incorrectos. Verifica tus datos.</p>
        </div>
      )}
      <div className="lg-fields">
        <div className="lg-field">
          <label className="lg-label">Correo electrónico</label>
          <div className="lg-input-wrap">
            <span className="lg-input-ic">{LI.mail}</span>
            <input type="email" className={'lg-input' + (err ? ' is-error' : '')}
              placeholder="tucorreo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="lg-field">
          <div className="lg-field-top">
            <label className="lg-label">Contraseña</label>
            <a className="lg-forgot" href="#">¿Olvidaste?</a>
          </div>
          <div className="lg-input-wrap">
            <span className="lg-input-ic">{LI.lock}</span>
            <input type={show ? 'text' : 'password'} className={'lg-input pwd' + (err ? ' is-error' : '')}
              placeholder="Tu contraseña" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <button type="button" className="lg-eye" onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Ocultar' : 'Mostrar'}>{show ? LI.eyeOff : LI.eye}</button>
          </div>
        </div>
      </div>
      <button type="submit" className="lg-submit">Iniciar sesión {LI.arrow}</button>
      <div className="lg-alt">¿No tienes cuenta? <a href="#">Crear cuenta</a></div>
    </form>
  );
}

Object.assign(window, { Logo, LoginForm, LoginV1, LoginV2, MobileLogin, MobileForm });
