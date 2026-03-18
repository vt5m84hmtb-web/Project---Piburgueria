-- ============================================================
-- π BURGUER — Setup Supabase
-- Cole este SQL no Supabase > SQL Editor > New Query > Run
-- ============================================================

-- 1. TABELA DE CONFIGURAÇÕES
CREATE TABLE IF NOT EXISTS pb_config (
  id    bigint PRIMARY KEY DEFAULT 1,
  wa    text,
  addr  text,
  map   text,
  pw    text
);

-- 2. TABELA DE PRODUTOS
CREATE TABLE IF NOT EXISTS pb_products (
  id         bigserial PRIMARY KEY,
  name       text        NOT NULL,
  desc       text,
  price      numeric(10,2),
  cat        text,
  tag        text,
  feat       boolean     DEFAULT false,
  img        text,
  created_at timestamptz DEFAULT now()
);

-- 3. TABELA DE BANNERS
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

-- ============================================================
-- 4. POLÍTICAS DE ACESSO (Row Level Security)
--    Permite leitura pública + escrita via anon key
-- ============================================================

ALTER TABLE pb_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pb_banners  ENABLE ROW LEVEL SECURITY;

-- pb_config
DROP POLICY IF EXISTS "config_read"  ON pb_config;
DROP POLICY IF EXISTS "config_write" ON pb_config;
CREATE POLICY "config_read"  ON pb_config FOR SELECT USING (true);
CREATE POLICY "config_write" ON pb_config FOR ALL    USING (true) WITH CHECK (true);

-- pb_products
DROP POLICY IF EXISTS "products_read"  ON pb_products;
DROP POLICY IF EXISTS "products_write" ON pb_products;
CREATE POLICY "products_read"  ON pb_products FOR SELECT USING (true);
CREATE POLICY "products_write" ON pb_products FOR ALL    USING (true) WITH CHECK (true);

-- pb_banners
DROP POLICY IF EXISTS "banners_read"  ON pb_banners;
DROP POLICY IF EXISTS "banners_write" ON pb_banners;
CREATE POLICY "banners_read"  ON pb_banners FOR SELECT USING (true);
CREATE POLICY "banners_write" ON pb_banners FOR ALL    USING (true) WITH CHECK (true);

-- ============================================================
-- PRONTO! Os dados padrão são inseridos automaticamente
-- na primeira vez que o site for aberto no navegador.
-- ============================================================
