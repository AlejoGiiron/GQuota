// G-Quota · lógica compartida de marca blanca y datos de ejemplo (window.GQ)
(function () {
  const TINTA = '#17150F';
  const h2r = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const valido = h => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h || '');
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const contraste = (a, b) => { const A = lum(h2r(a)), B = lum(h2r(b)); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  const mezcla = (a, b, t) => { const A = h2r(a), B = h2r(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase(); };
  // Texto sobre un color de marca: blanco o tinta, el de mayor contraste.
  const sobre = c => (contraste('#FFFFFF', c) >= contraste(TINTA, c) ? '#FFFFFF' : TINTA);
  // La marca usada como texto sobre blanco: se oscurece hacia la tinta hasta llegar a 4,5:1.
  const comoTexto = (c, fondo = '#FFFFFF') => { let t = 0, x = c; while (contraste(x, fondo) < 4.5 && t < 1) { t += 0.05; x = mezcla(c, TINTA, t); } return x; };
  const tokens = (marca, acento) => ({
    '--marca': marca, '--marca-sobre': sobre(marca), '--marca-texto': comoTexto(marca), '--marca-suave': mezcla(marca, '#FFFFFF', 0.88),
    '--acento': acento, '--acento-sobre': sobre(acento), '--acento-texto': comoTexto(acento),
  });
  const ratio = (a, b) => contraste(a, b).toFixed(1).replace('.', ',') + ':1';
  const tono = hex => { const [r, g, b] = h2r(hex).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return { h: 0, s: 0 }; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return { h, s: d / (1 - Math.abs(mx + mn - 1)) }; };
  const parecidoA = hex => { const { h, s } = tono(hex); if (s < 0.35) return ''; if (h < 18 || h > 342) return 'En mora'; if (h > 95 && h < 165) return 'Pagado'; if (h > 30 && h < 50) return 'Por vencer'; return ''; };
  const SALTAR = ['créditos', 'crédito', 'préstamos', 'préstamo', 'inversiones', 'multicréditos', 'finanzas', 'la', 'el', 'los', 'las', 'de', 'del', 'y'];
  const monograma = nombre => {
    const w = (nombre || '').trim().split(/\s+/).filter(Boolean); if (!w.length) return '·';
    const num = w.find(x => /^\d+$/.test(x)); if (num) return num.slice(0, 3);
    const r = w.filter(x => !SALTAR.includes(x.toLowerCase()));
    if (r.length >= 2) return (r[0][0] + r[1][0]).toUpperCase();
    if (r.length === 1) return (w[0] === r[0] ? r[0].slice(0, 2) : w[0][0] + r[0][0]).toUpperCase();
    return (w[0][0] + (w[1] ? w[1][0] : '')).toUpperCase();
  };

  const MARCAS = {
    'Créditos La 14 · verde': { colorNombre: 'verde', nombre: 'Créditos La 14', marca: '#127A3E', acento: '#F2B705', whatsapp: '300 000 0004', direccion: 'Cra. 14 # 23-41, Centro', doc: 'NIT 900.000.001-3', dueno: 'Jairo Londoño', saludo: 'Jairo', ini: 'JL', pie: 'Gracias por su pago puntual. Cualquier duda, escríbanos al WhatsApp.', recordatorio: 'Buenos días, {cliente}.', horario: 'Todos los días, 7:00 a. m. a 6:00 p. m.' },
    'Inversiones Morales · azul marino': { colorNombre: 'azul marino', nombre: 'Inversiones Morales', marca: '#16284A', acento: '#D4A017', whatsapp: '300 000 0005', direccion: 'Cl. 50 # 45-12, local 3', doc: 'C.C. 10.000.001', dueno: 'Hernando Morales', saludo: 'Hernando', ini: 'HM', pie: 'Conserve este comprobante. Gracias por su confianza.', recordatorio: 'Cordial saludo, {cliente}.', horario: 'Lunes a sábado, 8:00 a. m. a 5:00 p. m.' },
    'Préstamos Doña Rosa · amarillo': { colorNombre: 'amarilla', nombre: 'Préstamos Doña Rosa', marca: '#F6C90E', acento: '#D6336C', whatsapp: '300 000 0006', direccion: '', doc: '', dueno: 'Rosa Elvira Guzmán', saludo: 'Rosa', ini: 'RG', pie: 'Dios le pague por su cumplimiento.', recordatorio: 'Hola, {cliente}, que Dios la bendiga.', horario: 'Todos los días, 6:30 a. m. a 7:00 p. m.' },
    'Créditos Ramírez · rojo': { colorNombre: 'roja', nombre: 'Créditos Ramírez', marca: '#D21F3C', acento: '#1F2A44', whatsapp: '300 000 0007', direccion: 'Av. 3N # 44-20', doc: 'NIT 900.000.002-1', dueno: 'Óscar Ramírez', saludo: 'Óscar', ini: 'OR', pie: 'Gracias por su pago. Recuerde que su próxima cuota es mañana.', recordatorio: 'Buen día, {cliente}.', horario: 'Lunes a sábado, 7:00 a. m. a 6:00 p. m.' },
    'Multicréditos Yeni · fucsia': { colorNombre: 'fucsia', nombre: 'Multicréditos Yeni', marca: '#C8177A', acento: '#00A19A', whatsapp: '300 000 0008', direccion: 'Cl. 8 # 5-17, San Antonio', doc: '', dueno: 'Yeni Paola Rueda', saludo: 'Yeni', ini: 'YR', pie: 'Gracias por cumplir. Cualquier cosa, me escribe al WhatsApp.', recordatorio: 'Hola, {cliente}.', horario: 'Todos los días, 7:00 a. m. a 6:00 p. m.' },
  };
  const OPCIONES = Object.keys(MARCAS);
  const marca = k => { const m = MARCAS[k] || MARCAS[OPCIONES[0]]; const datos = [m.direccion, m.doc].filter(Boolean).join(' · '); return { ...m, mono: monograma(m.nombre), datos, tieneDatos: !!datos }; };
  const aplicar = (el, m) => { if (!el) return; const t = tokens(m.marca, m.acento); for (const k in t) el.style.setProperty(k, t[k]); };

  const CIR = 'M8 1.6a6.4 6.4 0 1 1 0 12.8a6.4 6.4 0 1 1 0-12.8Z';
  const TRI = 'M8 1.8L14.8 13.9H1.2Z';
  const CHK = 'M5 8.2l2 2 4-4.3';
  const E = {
    pagado: { c: '#1A7431', bg: '#E7F3EA', shape: CIR, fill: '#1A7431', mark: CHK, markC: '#FFFFFF', markFill: 'none' },
    aldia: { c: '#1A7431', bg: '#E7F3EA', shape: CIR, fill: 'none', mark: CHK, markC: '#1A7431', markFill: 'none' },
    hoy: { c: '#8A5300', bg: '#FCF1D9', shape: CIR, fill: 'none', mark: 'M8 4.8V8l2.2 1.5', markC: '#8A5300', markFill: 'none' },
    mora: { c: '#B3261E', bg: '#FBE8E6', shape: TRI, fill: '#B3261E', mark: 'M8 6.3v3.1M8 11.7v.1', markC: '#FFFFFF', markFill: 'none' },
    parcial: { c: '#2446B8', bg: '#E8EDFB', shape: CIR, fill: 'none', mark: 'M8 1.6a6.4 6.4 0 0 0 0 12.8Z', markC: '#2446B8', markFill: '#2446B8' },
    pendiente: { c: '#5B6472', bg: '#EEF0F3', shape: CIR, fill: 'none', mark: '', markC: 'none', markFill: 'none' },
    inactivo: { c: '#5B6472', bg: '#EEF0F3', shape: CIR, fill: 'none', mark: 'M5.2 10.8l5.6-5.6', markC: '#5B6472', markFill: 'none' },
  };
  E.vencida = E.mora;
  E.enviada = { c: '#5B6472', bg: '#EEF0F3', shape: CIR, fill: 'none', mark: 'M5.4 8h5M8.4 5.8L10.6 8l-2.2 2.2', markC: '#5B6472', markFill: 'none' };
  E.completada = { c: '#2446B8', bg: '#E8EDFB', shape: CIR, fill: 'none', mark: 'M8 5.6a2.4 2.4 0 1 1 0 4.8a2.4 2.4 0 1 1 0-4.8Z', markC: '#2446B8', markFill: '#2446B8' };
  E.aprobada = E.pagado;
  E.rechazada = { c: '#B3261E', bg: '#FBE8E6', shape: CIR, fill: 'none', mark: 'M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2', markC: '#B3261E', markFill: 'none' };
  E.vencidaEnlace = E.inactivo;
  const cop = n => (n < 0 ? '−' : '') + '$' + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const f2 = n => String(n).padStart(2, '0');
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const fd = d => `${f2(d.getDate())}/${f2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const fc = d => `${f2(d.getDate())}/${f2(d.getMonth() + 1)}`;
  const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const tile = (k, hoy) => ({ tileBg: k === 'pendiente' ? '#FFFFFF' : E[k].bg, tileBd: hoy ? '2px solid #8A5300' : k === 'pendiente' ? '1px solid #DADEE4' : '1px solid transparent' });

  const NAV = [
    ['Inicio', 'M4 10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4z'],
    ['Cobros de hoy', 'M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17'],
    ['Clientes', 'M9 11.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7ZM2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.9c1.7.8 2.7 2.4 3 5.1'],
    ['Solicitudes', 'M6 3h9l4 4v14H6zM14 3v5h5M9 14l2 2 4-4'],
  ['Préstamos', 'M2.5 6h19v12h-19zM12 9.4a2.6 2.6 0 1 0 0 5.2a2.6 2.6 0 1 0 0-5.2Z'],
  ['Plantillas', 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z'],
    ['Equipo', 'M4 3h16v18H4zM12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6ZM8 17c.8-1.8 2.2-2.6 4-2.6s3.2.8 4 2.6'],
    ['Mi marca', 'M12 3.5c3.6 4.1 6 7.2 6 10.2a6 6 0 0 1-12 0c0-3 2.4-6.1 6-10.2z'],
  ];
  const nav = act => NAV.map(([t, d]) => ({ t, d, bg: t === act ? 'var(--marca-suave)' : 'transparent', bar: t === act ? 'var(--marca)' : 'transparent', fw: t === act ? 600 : 500 }));

  // Cuotas pactadas · P-0317 · Carmen Rincón · 40 cuotas diarias consecutivas desde 19/08/2026
  const LBL_P = { pagado: 'Pagada', mora: 'Vencida', hoy: 'Vence hoy', pendiente: 'Pendiente' };
  const CRONO_P = Array.from({ length: 40 }, (_, i) => {
    const n = i + 1, d = addD(new Date(2026, 7, 19), i);
    const k = n <= 29 ? 'pagado' : n <= 35 ? 'mora' : n === 36 ? 'hoy' : 'pendiente';
    return { n: f2(n), dia: DIAS[d.getDay()], fecha: fd(d), fechaC: fc(d), capital: cop(20000), interes: cop(4000), cuota: cop(24000), st: E[k], label: LBL_P[k], rowBg: n === 36 ? '#FFFAEE' : '#FFFFFF', ...tile(k, n === 36) };
  });
  // Cuota fija · P-0352 · Hernán Darío Muñoz · 20 cuotas de $50.000 desde 05/09/2026
  const LBL_F = { pagado: 'Pagada', parcial: 'Parcial', pendiente: 'Pendiente' };
  const CRONO_F = Array.from({ length: 20 }, (_, i) => {
    const n = i + 1, d = addD(new Date(2026, 8, 5), i);
    const k = n <= 18 ? 'pagado' : n === 19 ? 'parcial' : 'pendiente';
    const ab = k === 'pagado' ? 50000 : k === 'parcial' ? 30000 : 0;
    return { n: f2(n), dia: DIAS[d.getDay()], fecha: fd(d), fechaC: fc(d), valor: cop(50000), abonado: ab ? cop(ab) : '—', falta: 50000 - ab ? cop(50000 - ab) : '—', st: E[k], label: LBL_F[k], rowBg: n === 19 ? '#F6F8FE' : '#FFFFFF', ...tile(k, false), tileNota: k === 'parcial' ? 'faltan $20.000' : '' };
  });
  // Abierto · P-0188 · Rubiela Agudelo · 10 % mensual sobre saldo
  const MOV_A = [
    ['12/05/2026', 'Desembolso', 'Interés del 1.er mes: $200.000', '$200.000', '', '', '$2.000.000', '$200.000'],
    ['10/06/2026', 'Pago', '$300.000 · efectivo', '', '$200.000', '$100.000', '$1.900.000', '$0'],
    ['12/06/2026', 'Interés del mes', '10 % sobre $1.900.000', '$190.000', '', '', '$1.900.000', '$190.000'],
    ['08/07/2026', 'Pago', '$390.000 · Nequi', '', '$190.000', '$200.000', '$1.700.000', '$0'],
    ['12/07/2026', 'Interés del mes', '10 % sobre $1.700.000', '$170.000', '', '', '$1.700.000', '$170.000'],
    ['11/08/2026', 'Pago', '$470.000 · efectivo', '', '$170.000', '$300.000', '$1.400.000', '$0'],
    ['12/08/2026', 'Interés del mes', '10 % sobre $1.400.000', '$140.000', '', '', '$1.400.000', '$140.000'],
    ['05/09/2026', 'Pago', '$140.000 · transferencia', '', '$140.000', '', '$1.400.000', '$0'],
    ['12/09/2026', 'Interés del mes', '10 % sobre $1.400.000', '$140.000', '', '', '$1.400.000', '$140.000'],
  ].map(([fecha, concepto, det, cargo, aInt, aCap, saldo, pend]) => ({ fecha, concepto, det, cargo: cargo || '—', aInt: aInt || '—', aCap: aCap || '—', saldo, pend, esPago: concepto === 'Pago' }));

  const COBRADORES = [
    ['YA', 'Yeison Arango', 'Centro – San Nicolás', 6, 14, 283000, 93000, 2, '9:20 a. m.'],
    ['BM', 'Brayan Muñoz', 'Barrio Obrero', 19, 28, 610000, 412000, 3, '9:16 a. m.'],
    ['LC', 'Luz Dary Cárdenas', 'Siloé – El Cortijo', 22, 30, 702000, 498000, 1, '9:19 a. m.'],
    ['WR', 'Wílmer Andrés Ríos', 'Los Mangos', 11, 24, 545000, 276000, 2, '8:47 a. m.'],
  ].map(([ini, nombre, zona, v, t, meta, cob, atr, ultimo]) => {
    const p = Math.round(cob / meta * 100);
    return { ini, nombre, zona, visitas: `${v} / ${t}`, meta: cop(meta), cobrado: cop(cob), porCobrar: cop(meta - cob), pct: p + ' %', p, barW: p + '%', atr, ultimo };
  }).sort((a, b) => b.p - a.p);
  const MORA = [
    ['Fredy Alonso Marín', 'Miscelánea Fredy', 'Wílmer Ríos', 22, 12, 360000],
    ['Rubén Darío Arias', 'Frutería Arias', 'Brayan Muñoz', 14, 12, 420000],
    ['Nelly Castrillón', 'Tienda Nelly', 'Luz Dary Cárdenas', 9, 6, 180000],
    ['Carmen Rincón', 'Restaurante El Fogón', 'Yeison Arango', 6, 6, 144000],
    ['Diana Patricia Henao', 'Papelería Diana', 'Brayan Muñoz', 6, 5, 150000],
  ].map(([nombre, negocio, cobrador, dias, cuotas, debe]) => ({ nombre, negocio, cobrador, dias, cuotas, debe: cop(debe) }));
  const PAGOS_P = [
    ['16/09/2026 · 10:12 a. m.', 'Cuota 29', 'Efectivo', 24000, '000431'],
    ['15/09/2026 · 9:48 a. m.', 'Cuota 28', 'Nequi', 24000, '000418'],
    ['14/09/2026 · 10:05 a. m.', 'Cuota 27', 'Efectivo', 24000, '000402'],
    ['13/09/2026 · 9:31 a. m.', 'Cuota 26', 'Efectivo', 24000, '000390'],
    ['12/09/2026 · 9:57 a. m.', 'Cuota 25', 'Daviplata', 24000, '000377'],
  ].map(([fecha, concepto, metodo, m, rec]) => ({ fecha, concepto, metodo, monto: cop(m), rec }));
  const PAGOS_F = [
    ['23/09/2026 · 9:05 a. m.', 'Abono a cuota 19', 'Efectivo', 30000, '000479'],
    ['22/09/2026 · 9:12 a. m.', 'Cuota 18', 'Efectivo', 50000, '000463'],
    ['21/09/2026 · 8:58 a. m.', 'Cuota 17', 'Nequi', 50000, '000447'],
    ['20/09/2026 · 9:40 a. m.', 'Cuota 16', 'Efectivo', 50000, '000433'],
  ].map(([fecha, concepto, metodo, m, rec]) => ({ fecha, concepto, metodo, monto: cop(m), rec }));

  const fila = (ini, nombre, sub, monto, extra = {}) => ({ ini, nombre, sub, monto, badge: false, cobrar: true, noCobrar: false, st: E.pendiente, label: '', extra: '', tag: false, ...extra });
  const SECCIONES = [
    { titulo: 'Atrasados', n: 2, total: '$60.000', rows: [
      fila('CR', 'Carmen Rincón', 'Restaurante El Fogón · cuota 36 de 40', '$24.000', { badge: true, st: E.mora, label: 'En mora · 6 días', extra: 'Debe $144.000', tag: true }),
      fila('ÁR', 'Álvaro Restrepo', 'Panadería La Espiga · cuota 19 de 30', '$36.000', { badge: true, st: E.mora, label: 'Vencida · 2 días', extra: 'Debe $72.000' }),
    ] },
    { titulo: 'Por cobrar', n: 7, total: '$130.000', rows: [
      fila('HM', 'Hernán Darío Muñoz', 'Cacharrería El Paisa · cuota 19 de 20', '$20.000', { badge: true, st: E.parcial, label: 'Parcial', extra: 'Abonó $30.000 de $50.000' }),
      fila('WP', 'Wilson Pérez', 'Taller Motos Wilson · cuota 11 de 40', '$25.000'),
      fila('LC', 'Leidy Johana Castaño', 'Peluquería Leidy · cuota 5 de 24', '$15.000'),
      fila('YO', 'Yurani Ospina', 'Minutos y recargas · cuota 2 de 30', '$8.000'),
      fila('JP', 'Jhon Jairo Pineda', 'Venta de jugos · cuota 17 de 30', '$20.000'),
      fila('GT', 'Gloria Inés Tabares', 'Modistería Gloria · cuota 9 de 28', '$12.000'),
      fila('OM', 'Óscar Iván Montoya', 'Ferretería El Tornillo · cuota 21 de 45', '$30.000'),
    ] },
    { titulo: 'Cobrados', n: 5, total: '$63.000', rows: [
      ['MV', 'Martha Lucía Vélez', 'Frutas Martha · cuota 25 de 28', '$10.000', '9:20 a. m.'],
      ['EC', 'Édgar Cifuentes', 'Zapatería Cifuentes · cuota 14 de 20', '$8.000', '8:52 a. m.'],
      ['NS', 'Nubia Serna', 'Salsamentaría Nubia · cuota 30 de 50', '$15.000', '8:31 a. m.'],
      ['LG', 'Luis Fernando Gómez', 'Frutería El Mango · cuota 8 de 30', '$20.000', '7:58 a. m.'],
      ['MO', 'María Eugenia Ocampo', 'Tienda La Esquina · cuota 15 de 28', '$10.000', '7:42 a. m.'],
    ].map(([i, n, s, m, h]) => fila(i, n, s, m, { badge: true, st: E.pagado, label: 'Pagado · ' + h, cobrar: false, noCobrar: true })) },
  ];

  const CLIENTES = [
    ['Carmen Rincón', 'Restaurante El Fogón', '10.000.002', '300 000 0001', 1, 264000, 'mora', 'En mora · 6 días', 'Yeison Arango'],
    ['Fredy Alonso Marín', 'Miscelánea Fredy', '1.000.000.001', '300 000 0009', 1, 540000, 'mora', 'En mora · 22 días', 'Wílmer Ríos'],
    ['Rubén Darío Arias', 'Frutería Arias', '10.000.003', '300 000 0010', 1, 610000, 'mora', 'En mora · 14 días', 'Brayan Muñoz'],
    ['Nelly Castrillón', 'Tienda Nelly', '10.000.004', '300 000 0011', 1, 300000, 'mora', 'En mora · 9 días', 'Luz Dary Cárdenas'],
    ['Álvaro Restrepo', 'Panadería La Espiga', '10.000.005', '300 000 0012', 1, 432000, 'mora', 'Vencida · 2 días', 'Yeison Arango'],
    ['Rubiela Agudelo', 'Tienda Rubiela', '10.000.006', '300 000 0003', 2, 1780000, 'aldia', 'Al día', 'Luz Dary Cárdenas'],
    ['Hernán Darío Muñoz', 'Cacharrería El Paisa', '10.000.007', '300 000 0002', 1, 70000, 'aldia', 'Al día', 'Yeison Arango'],
    ['Wilson Pérez', 'Taller Motos Wilson', '10.000.008', '300 000 0013', 1, 725000, 'aldia', 'Al día', 'Yeison Arango'],
    ['Leidy Johana Castaño', 'Peluquería Leidy', '1.000.000.002', '300 000 0014', 1, 285000, 'aldia', 'Al día', 'Yeison Arango'],
    ['Gloria Inés Tabares', 'Modistería Gloria', '10.000.009', '300 000 0015', 1, 228000, 'aldia', 'Al día', 'Yeison Arango'],
    ['Martha Lucía Vélez', 'Frutas Martha', '10.000.010', '300 000 0016', 1, 30000, 'aldia', 'Al día', 'Yeison Arango'],
    ['Yolanda Bedoya', 'Venta de arepas', '10.000.011', '300 000 0017', 1, 210000, 'pendiente', 'Sin cobrador', '—'],
  ].map(([nombre, negocio, cc, wa, prest, saldo, k, label, cobrador]) => ({ nombre, negocio, cc, wa, prest, saldoN: saldo, saldo: cop(saldo), st: E[k], label, cobrador }));
  const CLIENTES_TOTAL = cop(CLIENTES.reduce((a, c) => a + c.saldoN, 0));

  const PREST_RUBIELA = [
    ['P-0342', 'Cuota fija · diaria', '05/09/2026', 450000, 240000, '18 de 30', 'aldia', 'Al día'],
    ['P-0188', 'Abierto · mensual', '12/05/2026', 2000000, 1540000, 'saldo + interés', 'aldia', 'Al día'],
    ['P-0102', 'Cuotas pactadas · semanal', '03/01/2026', 600000, 0, '12 de 12', 'pagado', 'Pagado 28/03/2026'],
    ['P-0071', 'Cuota fija · diaria', '19/06/2025', 300000, 0, '28 de 28', 'pagado', 'Pagado 17/07/2025'],
  ].map(([id, tipo, desembolso, prestado, saldo, avance, k, label]) => ({ id, tipo, desembolso, prestado: cop(prestado), saldo: cop(saldo), avance, st: E[k], label }));
  const MOV_RUBIELA = [
    ['23/09/2026 · 8:10 a. m.', 'P-0342', 'Cuota 18', 'Efectivo', '$20.000', '000471'],
    ['22/09/2026 · 8:24 a. m.', 'P-0342', 'Cuota 17', 'Nequi', '$20.000', '000455'],
    ['21/09/2026 · 8:02 a. m.', 'P-0342', 'Cuota 16', 'Efectivo', '$20.000', '000439'],
    ['20/09/2026 · 8:15 a. m.', 'P-0342', 'Cuota 15', 'Efectivo', '$20.000', '000422'],
    ['05/09/2026 · 4:40 p. m.', 'P-0188', 'Pago de interés', 'Transferencia', '$140.000', '000301'],
  ].map(([fecha, prestamo, concepto, metodo, monto, rec]) => ({ fecha, prestamo, concepto, metodo, monto, rec }));

  const EQUIPO = [
    ['YA', 'Yeison Arango', 'yeison.arango@ejemplo.com', 'Centro – San Nicolás', 18, 4120000, '$283.000', 'aldia', 'Activo'],
    ['BM', 'Brayan Muñoz', 'brayanmunoz93@ejemplo.com', 'Barrio Obrero', 31, 6580000, '$610.000', 'aldia', 'Activo'],
    ['LC', 'Luz Dary Cárdenas', 'luzdary.cardenas@ejemplo.com', 'Siloé – El Cortijo', 33, 7160000, '$702.000', 'aldia', 'Activo'],
    ['WR', 'Wílmer Andrés Ríos', 'wilmer.rios@ejemplo.com', 'Los Mangos', 24, 5130000, '$545.000', 'aldia', 'Activo'],
    ['JO', 'Julián Ocampo', 'julian.ocampo@ejemplo.com', '—', 0, 0, '—', 'inactivo', 'Inactivo'],
  ].map(([ini, nombre, correo, zona, n, cartera, meta, k, label]) => ({ ini, nombre, correo, zona, n, cartera: cop(cartera), meta, st: E[k], label, op: k === 'inactivo' ? '#5B6472' : '#14181F' }));
  const SIN_ASIGNAR = [
    [true, 'Yolanda Bedoya', 'Venta de arepas', 'P-0371', 'Cuota fija · diaria', '$15.000', 210000, '22/09/2026'],
    [true, 'Andrés Felipe Loaiza', 'Barbería Loaiza', 'P-0370', 'Cuota fija · diaria', '$12.000', 180000, '22/09/2026'],
    [true, 'Ana Milena Cruz', 'Tienda Ana', 'P-0368', 'Cuotas pactadas · diaria', '$18.000', 270000, '21/09/2026'],
    [false, 'Omaira Gil', 'Restaurante Omaira', 'P-0366', 'Abierto · mensual', '—', 300000, '19/09/2026'],
    [false, 'Jhonatan Ríos', 'Lavadero de motos', 'P-0363', 'Cuota fija · diaria', '$10.000', 160000, '18/09/2026'],
    [false, 'Luz Marina Ortiz', 'Venta de tamales', 'P-0359', 'Cuotas pactadas · semanal', '$40.000', 200000, '16/09/2026'],
  ].map(([sel, nombre, negocio, id, tipo, cuota, saldo, fecha]) => ({ sel, nombre, negocio, id, tipo, cuota, saldo: cop(saldo), fecha, rowBg: sel ? 'var(--marca-suave)' : '#FFFFFF', chkBg: sel ? '#14181F' : '#FFFFFF', chkBd: sel ? '#14181F' : '#9AA3AF' }));

  window.GQ = { TINTA, contraste, mezcla, sobre, comoTexto, tokens, ratio, valido, parecidoA, monograma, MARCAS, OPCIONES, marca, aplicar, E, cop, nav, CRONO_P, CRONO_F, MOV_A, COBRADORES, MORA, PAGOS_P, PAGOS_F, SECCIONES, CLIENTES, CLIENTES_TOTAL, PREST_RUBIELA, MOV_RUBIELA, EQUIPO, SIN_ASIGNAR };
})();
