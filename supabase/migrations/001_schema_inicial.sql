-- ============================================================
--  Esquema inicial — Software de préstamos
--  Modelo: interés mensual sobre saldo + pago flexible
--    (pagar solo interés  |  pagar cuota que abona a capital)
--  Plataforma: Supabase (PostgreSQL)
--  Multi-tenant por user_id + Row Level Security (RLS)
-- ============================================================

-- ----------------------------------------------------------------
--  CLIENTES (deudores)
-- ----------------------------------------------------------------
create table public.clientes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  documento   text,
  telefono    text,
  direccion   text,
  notas       text,
  created_at  timestamptz not null default now()
);
create index on public.clientes (user_id);

-- ----------------------------------------------------------------
--  PRÉSTAMOS
-- ----------------------------------------------------------------
create table public.prestamos (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  cliente_id       uuid not null references public.clientes(id) on delete restrict,
  capital_inicial  numeric(14,2) not null check (capital_inicial > 0),
  saldo_capital    numeric(14,2) not null,                 -- saldo vigente; baja con cada abono
  tasa_mensual     numeric(7,4)  not null check (tasa_mensual >= 0), -- 0.1000 = 10% mensual
  modo_interes     text not null default 'sobre_saldo'               -- forma de cobro del interés
                   check (modo_interes in ('sobre_saldo','sobre_capital_inicial')),
  fecha_desembolso date not null,
  dia_cobro        int check (dia_cobro between 1 and 31),  -- día de cobro del interés (opcional)
  estado           text not null default 'activo'
                   check (estado in ('activo','pagado','en_mora','cancelado')),
  notas            text,
  created_at       timestamptz not null default now()
);
create index on public.prestamos (user_id);
create index on public.prestamos (cliente_id);

-- ----------------------------------------------------------------
--  MOVIMIENTOS  (libro mayor / ledger)
--  Una fila por: desembolso inicial, pago de interés,
--  abono a capital, o cuota completa.
-- ----------------------------------------------------------------
create table public.movimientos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  prestamo_id     uuid not null references public.prestamos(id) on delete cascade,
  fecha           date not null default current_date,
  tipo            text not null
                  check (tipo in ('desembolso','interes','abono_capital','cuota')),
  monto_total     numeric(14,2) not null check (monto_total >= 0),
  monto_interes   numeric(14,2) not null default 0,   -- parte aplicada a interés
  monto_capital   numeric(14,2) not null default 0,   -- parte aplicada a capital
  saldo_anterior  numeric(14,2) not null,
  saldo_posterior numeric(14,2) not null,
  metodo_pago     text,    -- efectivo | nequi | daviplata | transferencia | otro
  nota            text,
  created_at      timestamptz not null default now()
);
create index on public.movimientos (prestamo_id, fecha);

-- ============================================================
--  Seguridad a nivel de fila: cada usuario ve SOLO sus datos
-- ============================================================
alter table public.clientes    enable row level security;
alter table public.prestamos   enable row level security;
alter table public.movimientos enable row level security;

create policy "clientes_propios" on public.clientes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "prestamos_propios" on public.prestamos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "movimientos_propios" on public.movimientos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
