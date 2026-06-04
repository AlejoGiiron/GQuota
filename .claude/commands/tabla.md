Crea una tabla nueva en Supabase para G-Quota.

Pide el nombre y las columnas si no te los doy. Genera:
- Un archivo de migración en supabase/migrations con número consecutivo.
- La columna user_id referenciando auth.users, con RLS habilitada y políticas que permitan al usuario operar solo sus propias filas (igual que clientes, prestamos y movimientos).
- Índices para las llaves foráneas.

Luego dime cómo aplicarla y recuérdame regenerar src/types/database.types.ts.