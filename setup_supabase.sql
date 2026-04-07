-- ============================================================
-- π BURGUER — SCRIPT PROFISSIONAL UNIFICADO (VERSÃO FINAL)
-- Seguro para rodar múltiplas vezes
-- Corrige coluna delivery_code e evita erro PGRST204
-- ============================================================

-- ============================================================
-- 1. CONFIGURAÇÕES DA LOJA
-- ============================================================

CREATE TABLE IF NOT EXISTS pb_config (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  store_name text DEFAULT 'π Burguer',
  whatsapp text,
  address text,
  map_embed text,

  wa text,
  addr text,
  map text,
  pw text,

  fee_per_km numeric(10,2) DEFAULT 2.50,
  min_delivery_fee numeric(10,2) DEFAULT 5.00,

  admin_password text DEFAULT 'admin123',

  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. PRODUTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS pb_products (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,

  category text DEFAULT 'burger',
  tag text,
  featured boolean DEFAULT false,

  image text,

  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. BANNERS
-- ============================================================

CREATE TABLE IF NOT EXISTS pb_banners (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  title text,
  title_highlight text,
  subtitle text,

  badge text,
  badge_type text DEFAULT 'gold',

  image text,

  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 4. CLIENTES
-- ============================================================

CREATE TABLE IF NOT EXISTS pb_customers (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  name text,
  phone text,
  email text UNIQUE,
  password_hash text,

  address text,
  neighborhood text,
  complement text,

  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 5. ENTREGADORES
-- ============================================================

CREATE TABLE IF NOT EXISTS pb_deliverers (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  name text,
  phone text,
  email text UNIQUE,
  password_hash text,

  vehicle text,
  plate text,

  status text DEFAULT 'offline',

  current_order_id bigint,
  total_deliveries int DEFAULT 0,

  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 6. PEDIDOS
-- ============================================================

CREATE TABLE IF NOT EXISTS pb_orders (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  order_number text UNIQUE,

  customer_id bigint,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text NOT NULL,

  items jsonb NOT NULL,

  subtotal numeric(10,2) DEFAULT 0,
  distance_km numeric(10,2) DEFAULT 0,
  delivery_fee numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0,

  payment_method text DEFAULT 'pending',
  payment_status text DEFAULT 'pending',
  mp_payment_id text,

  status text DEFAULT 'pending',

  deliverer_id bigint,
  deliverer_name text,

  notes text,

  delivery_code text,
  deliverer_confirmed boolean DEFAULT false,
  customer_confirmed boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- GARANTIA: cria coluna mesmo se tabela já existir
ALTER TABLE pb_orders
ADD COLUMN IF NOT EXISTS delivery_code text;

ALTER TABLE pb_orders
ADD COLUMN IF NOT EXISTS deliverer_confirmed boolean DEFAULT false;

ALTER TABLE pb_orders
ADD COLUMN IF NOT EXISTS customer_confirmed boolean DEFAULT false;

-- ============================================================
-- 7. PAGAMENTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS pb_payments (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  order_id bigint REFERENCES pb_orders(id) ON DELETE CASCADE,

  method text,
  amount numeric(10,2),
  status text DEFAULT 'pending',

  mp_id text,
  pix_key text,
  card_last4 text,

  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 8. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_number
ON pb_orders(order_number);

CREATE INDEX IF NOT EXISTS idx_orders_status
ON pb_orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_phone
ON pb_orders(customer_phone);

-- ============================================================
-- 9. TRIGGER: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_orders_timestamp ON pb_orders;

CREATE TRIGGER trg_update_orders_timestamp
BEFORE UPDATE ON pb_orders
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE pb_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_banners    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_customers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_deliverers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_payments   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11. POLÍTICAS (ACESSO TOTAL)
-- ============================================================

DROP POLICY IF EXISTS "config_all"     ON pb_config;
DROP POLICY IF EXISTS "products_all"   ON pb_products;
DROP POLICY IF EXISTS "banners_all"    ON pb_banners;
DROP POLICY IF EXISTS "customers_all"  ON pb_customers;
DROP POLICY IF EXISTS "orders_all"     ON pb_orders;
DROP POLICY IF EXISTS "deliverers_all" ON pb_deliverers;
DROP POLICY IF EXISTS "payments_all"   ON pb_payments;

CREATE POLICY "config_all"
ON pb_config FOR ALL TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "products_all"
ON pb_products FOR ALL TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "banners_all"
ON pb_banners FOR ALL TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "customers_all"
ON pb_customers FOR ALL TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "orders_all"
ON pb_orders FOR ALL TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "deliverers_all"
ON pb_deliverers FOR ALL TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "payments_all"
ON pb_payments FOR ALL TO anon
USING (true)
WITH CHECK (true);

-- ============================================================
-- 12. FUNÇÃO: CONFIRMAR ENTREGA (CORRIGIDA)
-- ============================================================

CREATE OR REPLACE FUNCTION confirm_delivery(
  p_order_number TEXT,
  p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_order pb_orders%ROWTYPE;
BEGIN

  SELECT * INTO v_order
  FROM pb_orders
  WHERE order_number = p_order_number;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pedido não encontrado'
    );
  END IF;

  IF v_order.delivery_code != UPPER(p_code) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Código inválido'
    );
  END IF;

  UPDATE pb_orders
  SET
    status = 'delivered',
    deliverer_confirmed = true,
    customer_confirmed = true
  WHERE order_number = p_order_number;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Entrega confirmada com sucesso'
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FINAL — ATUALIZAR CACHE
-- ============================================================

NOTIFY pgrst, 'reload schema';