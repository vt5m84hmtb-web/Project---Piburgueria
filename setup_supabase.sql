-- ============================================================
-- PI BURGUER - Setup Supabase (Cardapio + Central de Pedidos)
-- Cole este SQL no Supabase > SQL Editor > New Query > Run
-- ============================================================

-- 1) TABELAS DO CARDAPIO
CREATE TABLE IF NOT EXISTS pb_config (
  id    bigint PRIMARY KEY DEFAULT 1,
  wa    text,
  addr  text,
  map   text,
  pw    text
);

CREATE TABLE IF NOT EXISTS pb_products (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL,
  descr      text,
  price      numeric(10,2),
  cat        text,
  tag        text,
  feat       boolean DEFAULT false,
  img        text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pb_banners (
  id              bigserial PRIMARY KEY,
  title           text NOT NULL,
  title_highlight text,
  sub             text,
  badge           text,
  badge_type      text DEFAULT 'gold',
  img             text,
  created_at      timestamptz DEFAULT now()
);

-- 2) TABELAS DA CENTRAL
CREATE TABLE IF NOT EXISTS pb_customers (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text,
  phone text,
  email text,
  password_hash text,
  address text,
  neighborhood text,
  complement text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pb_orders (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_number text,
  customer_id bigint,
  customer_name text,
  customer_phone text,
  customer_address text,
  items jsonb,
  subtotal numeric DEFAULT 0,
  delivery_fee numeric DEFAULT 5,
  total numeric DEFAULT 0,
  payment_method text,
  payment_status text DEFAULT 'pending',
  status text DEFAULT 'received',
  deliverer_id bigint,
  deliverer_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pb_deliverers (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text,
  phone text,
  email text,
  vehicle text,
  plate text,
  password text,
  status text DEFAULT 'offline',
  current_order_id bigint,
  total_deliveries int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Migração para bancos já existentes sem coluna de e-mail:
ALTER TABLE IF EXISTS pb_deliverers
ADD COLUMN IF NOT EXISTS email text;

CREATE TABLE IF NOT EXISTS pb_payments (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_id bigint,
  method text,
  amount numeric,
  status text DEFAULT 'pending',
  pix_key text,
  card_last4 text,
  created_at timestamptz DEFAULT now()
);

-- 3) RLS + POLITICAS PERMISSIVAS (anon)
ALTER TABLE pb_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_banners    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_customers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_deliverers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_payments   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_read"  ON pb_config;
DROP POLICY IF EXISTS "config_write" ON pb_config;
CREATE POLICY "config_read"  ON pb_config FOR SELECT USING (true);
CREATE POLICY "config_write" ON pb_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_read"  ON pb_products;
DROP POLICY IF EXISTS "products_write" ON pb_products;
CREATE POLICY "products_read"  ON pb_products FOR SELECT USING (true);
CREATE POLICY "products_write" ON pb_products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "banners_read"  ON pb_banners;
DROP POLICY IF EXISTS "banners_write" ON pb_banners;
CREATE POLICY "banners_read"  ON pb_banners FOR SELECT USING (true);
CREATE POLICY "banners_write" ON pb_banners FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "customers_read"  ON pb_customers;
DROP POLICY IF EXISTS "customers_write" ON pb_customers;
CREATE POLICY "customers_read"  ON pb_customers FOR SELECT USING (true);
CREATE POLICY "customers_write" ON pb_customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "orders_read"  ON pb_orders;
DROP POLICY IF EXISTS "orders_write" ON pb_orders;
CREATE POLICY "orders_read"  ON pb_orders FOR SELECT USING (true);
CREATE POLICY "orders_write" ON pb_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "deliverers_read"  ON pb_deliverers;
DROP POLICY IF EXISTS "deliverers_write" ON pb_deliverers;
CREATE POLICY "deliverers_read"  ON pb_deliverers FOR SELECT USING (true);
CREATE POLICY "deliverers_write" ON pb_deliverers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "payments_read"  ON pb_payments;
DROP POLICY IF EXISTS "payments_write" ON pb_payments;
CREATE POLICY "payments_read"  ON pb_payments FOR SELECT USING (true);
CREATE POLICY "payments_write" ON pb_payments FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PRONTO! Ao abrir os HTML, o sistema ja pode operar completo.
-- ============================================================
