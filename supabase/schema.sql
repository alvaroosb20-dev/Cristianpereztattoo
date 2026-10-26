-- =====================================================================
-- Cristhian Pérez Tattoo · Esquema de base de datos (Supabase / Postgres)
-- Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este archivo → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------- Ajustes (una sola fila con todo en JSON) ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- ---------- Productos ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  category text not null default 'ropa',
  price_cents int not null check (price_cents >= 0),
  images text[] not null default '{}',
  variants jsonb not null default '[]'::jsonb,   -- [{"name":"Talla","options":[{"label":"M"},{"label":"XL","price_cents":3900}]}]
  stock int not null default 0 check (stock >= 0),
  active boolean not null default true,
  featured boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Pedidos ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','shipped','completed','cancelled','refunded','expired')),
  customer jsonb not null,            -- {name,email,phone}
  shipping_address jsonb not null default '{}'::jsonb,
  billing jsonb not null default '{}'::jsonb,
  items jsonb not null,               -- copia de los productos, precios y opciones en el momento de la compra
  notes text default '',
  shipping_zone text,
  shipping_label text,
  subtotal_cents int not null,
  shipping_cents int not null default 0,
  total_cents int not null,
  stripe_session_id text,
  stripe_payment_intent text,
  tracking text default '',
  admin_notes text default '',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists orders_status_idx on public.orders (status, created_at desc);

-- ---------- Citas ----------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','pending','confirmed','completed','cancelled','rejected','expired','needs_attention')),
  name text not null,
  email text,
  phone text,
  style text,
  body_zone text,
  size_id text,
  size_label text,
  description text not null default '',
  design_path text,                       -- ruta en el bucket privado "designs"
  appt_date date not null,
  start_min int not null check (start_min >= 0 and start_min < 1440),
  end_min int not null check (end_min > start_min and end_min <= 1440),
  estimated_price_cents int,
  final_price_cents int,
  deposit_cents int not null default 0,
  deposit_paid boolean not null default false,
  payment_status text not null default 'unpaid',   -- unpaid | paid | refunded | manual
  stripe_session_id text,
  stripe_payment_intent text,
  paid_at timestamptz,
  adult_confirmed boolean not null default false,
  terms_accepted_at timestamptz,          -- registro de aceptación de las condiciones
  terms_hash text,
  terms_snapshot text,                    -- copia exacta del texto aceptado
  hold_expires_at timestamptz,            -- la hora queda bloqueada mientras el cliente paga
  admin_notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_date_idx on public.bookings (appt_date, start_min);
create index if not exists bookings_status_idx on public.bookings (status);

-- Impide a nivel de base de datos que dos citas activas se solapen el mismo día.
do $$ begin
  alter table public.bookings add constraint bookings_no_overlap
    exclude using gist (appt_date with =, int4range(start_min, end_min) with &&)
    where (status in ('pending_payment','pending','confirmed'));
exception when duplicate_object or duplicate_table then null; end $$;

-- ---------- Días / horas bloqueadas (vacaciones, convenciones, descansos puntuales) ----------
create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  date_from date not null,
  date_to date not null,
  start_min int,          -- null = día completo
  end_min int,
  reason text default '',
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);

-- ---------- Portafolio ----------
create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'photo' check (kind in ('photo','video')),
  src text not null,
  poster text default '',
  title text default '',
  style text default '',
  sort int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Opiniones (solo reales, añadidas por el estudio) ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  text text not null,
  rating int default 5 check (rating between 1 and 5),
  visible boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Funciones ----------
create or replace function public.decrement_stock(p_id uuid, p_qty int)
returns void language sql security definer set search_path = public as $$
  update public.products set stock = greatest(0, stock - p_qty) where id = p_id;
$$;

create or replace function public.booking_counts()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
  from (select status, count(*) n from public.bookings group by status) t;
$$;

revoke all on function public.decrement_stock(uuid, int) from public, anon, authenticated;
revoke all on function public.booking_counts() from public, anon, authenticated;

-- ---------- Seguridad: RLS activado y SIN políticas públicas ----------
-- Solo el servidor (con la service_role key, que nunca llega al navegador) puede leer y escribir.
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.bookings enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.portfolio enable row level security;
alter table public.reviews enable row level security;

-- ---------- Almacenamiento ----------
-- designs: PRIVADO (diseños de clientes, solo con enlace firmado temporal)
-- media:   público (fotos de productos y portafolio)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('designs', 'designs', false, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 4194304, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

-- ---------- Datos iniciales (solo si las tablas están vacías) ----------
insert into public.portfolio (kind, src, poster, title, style, sort)
select * from (values
  ('video', 'media/video-1.mp4', 'media/video-1.jpg', 'Sesión en el estudio · fine line', 'Fine line', 1),
  ('video', 'media/video-2.mp4', 'media/video-2.jpg', 'Del stencil a la pieza', 'Microrealismo', 2),
  ('photo', 'media/tattoo-estatua.webp', '', 'Estatua clásica y proporción áurea', 'Realismo black & grey', 3),
  ('photo', 'media/tattoo-impossible.webp', '', 'Impossible · espalda editorial', 'Lettering editorial', 4)
) v(kind, src, poster, title, style, sort)
where not exists (select 1 from public.portfolio);

insert into public.products (slug, name, category, price_cents, stock, featured, sort, images, description, variants)
select * from (values
  ('camiseta-estatua', 'Camiseta Estatua', 'ropa', 3500, 40, true, 1, array['img/products/camiseta-estatua.svg'],
   'Camiseta negra de algodón grueso con la estatua clásica del estudio serigrafiada en blanco hueso. Corte recto, cuello reforzado.',
   '[{"name":"Talla","options":[{"label":"S"},{"label":"M"},{"label":"L"},{"label":"XL"},{"label":"XXL"}]}]'::jsonb),
  ('camiseta-impossible', 'Camiseta Impossible', 'ropa', 3500, 30, true, 2, array['img/products/camiseta-impossible.svg'],
   'Camiseta blanca con la portada «Impossible» en tipografía de revista. Tinta negra al agua, tacto suave.',
   '[{"name":"Talla","options":[{"label":"S"},{"label":"M"},{"label":"L"},{"label":"XL"}]}]'::jsonb),
  ('gorra-cp', 'Gorra CP', 'gorras', 3000, 25, true, 3, array['img/products/gorra-cp.svg'],
   'Gorra de seis paneles con el monograma CP bordado. Cierre ajustable.',
   '[{"name":"Color","options":[{"label":"Negro"},{"label":"Hueso"}]}]'::jsonb),
  ('sudadera-estudio', 'Sudadera Estudio', 'ropa', 5900, 20, false, 4, array['img/products/sudadera-estudio.svg'],
   'Sudadera con capucha, felpa perchada y el nombre del estudio en la espalda.',
   '[{"name":"Talla","options":[{"label":"S"},{"label":"M"},{"label":"L"},{"label":"XL"}]}]'::jsonb),
  ('balsamo-aftercare', 'Bálsamo Aftercare 50 ml', 'cuidado', 1400, 60, true, 5, array['img/products/balsamo.svg'],
   'Bálsamo para la cicatrización del tatuaje. Aplica una capa fina dos o tres veces al día durante las dos primeras semanas.', '[]'::jsonb),
  ('kit-cuidado', 'Kit de cuidado', 'cuidado', 2400, 30, false, 6, array['img/products/kit.svg'],
   'Bálsamo de 50 ml, jabón neutro y film protector. Todo lo que necesitas para los primeros días.', '[]'::jsonb),
  ('print-proporcion-aurea', 'Print Proporción Áurea', 'prints', 4000, 15, false, 7, array['img/products/print.svg'],
   'Lámina A3 del boceto original de la estatua con espiral áurea. Papel algodón de 300 g, edición numerada.',
   '[{"name":"Formato","options":[{"label":"A3"},{"label":"A4","price_cents":2800}]}]'::jsonb),
  ('tarjeta-regalo', 'Tarjeta regalo', 'regalo', 10000, 999, false, 8, array['img/products/tarjeta-regalo.svg'],
   'Regala un tatuaje. Elige el importe (100 €, 150 €, 200 € o 250 €) o una sesión de brazo completa por 370 €. Válida para sesiones en el estudio durante 12 meses.',
   '[{"name":"Importe","options":[{"label":"100 €","price_cents":10000},{"label":"150 €","price_cents":15000},{"label":"200 €","price_cents":20000},{"label":"250 €","price_cents":25000},{"label":"Sesión de brazo · 370 €","price_cents":37000}]}]'::jsonb)
) v(slug, name, category, price_cents, stock, featured, sort, images, description, variants)
where not exists (select 1 from public.products);

-- Tarjeta regalo: importes 100/150/200/250 € y sesión de brazo 370 € (también si ya existía)
update public.products set price_cents = 10000,
  description = 'Regala un tatuaje. Elige el importe (100 €, 150 €, 200 € o 250 €) o una sesión de brazo completa por 370 €. Válida para sesiones en el estudio durante 12 meses.',
  variants = '[{"name":"Importe","options":[{"label":"100 €","price_cents":10000},{"label":"150 €","price_cents":15000},{"label":"200 €","price_cents":20000},{"label":"250 €","price_cents":25000},{"label":"Sesión de brazo · 370 €","price_cents":37000}]}]'::jsonb
where slug = 'tarjeta-regalo';
