
      /* ---------------------------------------------------------------
         CONFIGURA��ES PRINCIPAIS � EDITE AQUI
      --------------------------------------------------------------- */

      // -- SUPABASE --
      const SUPABASE_URL = 'https://cwjlkovqpdpmtgblidrv.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3amxrb3ZxcGRwbXRnYmxpZHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODczODYsImV4cCI6MjA4OTM2MzM4Nn0.-AhhMLSUOhjZqE1SCfK4B1tCYm0atguUqPtRpSi-sKs';
      const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

      /* ---------------------------------------------------------------
         CONFIGURA��O MERCADO PAGO
         -------------------------------------------------------------
         PASSO A PASSO:
         1. Acesse https://www.mercadopago.com.br e crie uma conta
         2. V� em: Seu perfil ? Ferramentas para desenvolvedores ? Credenciais
         3. Copie a "Public key" (come�a com TEST- para sandbox)
         4. Cole abaixo substituindo 'SUA_PUBLIC_KEY_AQUI'
         5. O Access Token (secret) deve ficar APENAS no servidor/backend
         6. Para testar sem backend, use o modo simula��o (DEMO_MODE = true)
         -------------------------------------------------------------
         COMO TESTAR COM SANDBOX:
         - Use Public Key que come�a com "TEST-"
         - Cart�es de teste: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards
         - Cart�o aprovado: 5031 4332 1540 6351 | Vencimento: 11/25 | CVV: 123
      --------------------------------------------------------------- */
      const MERCADO_PAGO_PUBLIC_KEY = 'SUA_PUBLIC_KEY_AQUI'; // ? SUBSTITUA AQUI
      const DEMO_MODE = MERCADO_PAGO_PUBLIC_KEY === 'SUA_PUBLIC_KEY_AQUI'; // true = modo demonstra��o

      /* ---------------------------------------------------------------
         ENTREGA AUTOM�TICA (ENDERE�O, DIST�NCIA E TAXA)
         -------------------------------------------------------------
         STORE_ADDRESS: origem fixa da loja (endereço real para Nominatim)
         DELIVERY_FEE_PER_KM: valor cobrado por km
         MAPS_API_KEY: opcional (Open Route Service)
      --------------------------------------------------------------- */
      const MAPS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImI2ZTAwMDA5NzkyOTRmNjA4N2EwMzZhYTU1MDliMWFhIiwiaCI6Im11cm11cjY0In0='; // Deixar vazio usa OSRM (gratuito)
      let STORE_ADDRESS = 'Rua T-63, 742 — Setor Bueno, Goiânia — GO, 74230-100'; // EDITE COM SEU ENDEREÇO REAL
      let DELIVERY_FEE_PER_KM = 2.00;

      // Preparo para regras futuras (mantidas desligadas por padr�o)
      const MAX_DELIVERY_DISTANCE_KM = 10;
      const MIN_DELIVERY_FEE = 5;
      const FREE_DELIVERY_OVER = 100;
      const DELIVERY_RULES = {
        enforceMaxDistance: false,
        enforceMinFee: false,
        enableFreeDeliveryOver: false
      };

      /* --- DADOS PADR�O (SEEDS) --- */
      const SEED_PRODUCTS = [
        { name: 'PiBacon',    descr: 'Pão brioche · cream cheese de bacon · blend 130g · cheddar · cebola roxa · bacon em dobro · maionese caseira', price: 32.90, cat: 'burger', tag: 'hit',  feat: true,  img: null },
        { name: 'PiClássico', descr: 'Pão brioche · blend 130g · cheddar · cebola roxa · bacon · tomate · alface · maionese caseira',                price: 28.90, cat: 'burger', tag: 'novo', feat: true,  img: null },
        { name: 'PiDouble',   descr: 'Pão brioche · dois blends 130g · queijo duplo · molho especial · picles artesanal',                          price: 39.90, cat: 'burger', tag: 'smash',feat: true,  img: null },
      ];
      const SEED_BANNERS = [
        { title: 'PiBacon',   title_highlight: 'Pi', sub: 'Cream cheese · Cheddar · Bacon duplo', badge: '?? Mais pedido hoje',  badge_type: 'red',   img: null },
        { title: 'PiClássico',title_highlight: 'Pi', sub: 'O sabor equilibrado perfeito',          badge: '? Novo no cardpio', badge_type: 'green', img: null },
        { title: 'Combos',    title_highlight: '',   sub: 'Economize mais pedindo combos!',        badge: '?? Promoção especial',badge_type: 'gold',  img: null },
      ];
      const SEED_CONFIG = { id: 1, wa: '5562999999999', addr: 'Goiânia, Goiás - Brasil', map: '', pw: 'admin123', fee_per_km: 2.00 };

      let PRODUCTS = [], BANNERS = [], CONFIG = { ...SEED_CONFIG };

      /* ---------------------------------------------------------------
         BANCO DE DADOS � INICIALIZA��O
         O Supabase precisa das seguintes tabelas:
           - pb_config (id, wa, addr, map, pw, fee_per_km)
           - pb_products (id, name, descr, price, cat, tag, feat, img)
           - pb_banners (id, title, title_highlight, sub, badge, badge_type, img)
           - pb_orders (id, order_number, customer_name, customer_phone,
                        customer_address, items, subtotal, delivery_fee,
                        distance_km, total, payment_method, payment_status,
                        mp_payment_id, status, delivery_code, notes,
                        deliverer_confirmed, customer_confirmed, created_at)
      --------------------------------------------------------------- */
      async function initDB() {
        try {
          const { data: cfgData, error: cfgErr } = await sb.from('pb_config').select('*').eq('id', 1).maybeSingle();
          if (cfgErr) { fallback(); return false; }
          if (!cfgData) { await sb.from('pb_config').insert(SEED_CONFIG); CONFIG = { ...SEED_CONFIG }; }
          else { CONFIG = cfgData; }

          // Carrega taxa por km do banco se dispon�vel
          if (CONFIG.fee_per_km) DELIVERY_FEE_PER_KM = parseFloat(CONFIG.fee_per_km);
          if (CONFIG.addr) STORE_ADDRESS = CONFIG.addr;

          const { data: prodsData, error: prodsErr } = await sb.from('pb_products').select('*').order('id');
          if (prodsErr) { fallback(); return false; }
          if (!prodsData || prodsData.length === 0) {
            await sb.from('pb_products').insert(SEED_PRODUCTS);
            const { data: p2 } = await sb.from('pb_products').select('*').order('id');
            PRODUCTS = p2 || [];
          } else { PRODUCTS = prodsData; }

          const { data: bansData, error: bansErr } = await sb.from('pb_banners').select('*').order('id');
          if (bansErr) { fallback(); return false; }
          if (!bansData || bansData.length === 0) {
            await sb.from('pb_banners').insert(SEED_BANNERS);
            const { data: b2 } = await sb.from('pb_banners').select('*').order('id');
            BANNERS = b2 || [];
          } else { BANNERS = bansData; }

          setDbBadge(true);
          return true;
        } catch (e) { fallback(); return false; }
      }

      function fallback() {
        PRODUCTS = SEED_PRODUCTS.map((p, i) => ({ ...p, id: i + 1 }));
        BANNERS  = SEED_BANNERS.map((b, i) => ({ ...b, id: i + 1 }));
        CONFIG   = { ...SEED_CONFIG };
        STORE_ADDRESS = CONFIG.addr || STORE_ADDRESS;
        setDbBadge(false);
      }

      function setDbBadge(ok) {
        const el = document.getElementById('db-status-badge');
        if (!el) return;
        el.textContent = ok ? '? Conectado' : '? Offline';
        el.className = ok ? 'db-badge' : 'db-badge err';
      }

      async function reloadProducts() { const { data } = await sb.from('pb_products').select('*').order('id'); if (data) PRODUCTS = data; }
      async function reloadBanners()  { const { data } = await sb.from('pb_banners').select('*').order('id');  if (data) BANNERS  = data; }

      /* ---------------------------------------------------------------
         SISTEMA DE CARRINHO
         O carrinho � armazenado em mem�ria (array cart[]).
         Persiste enquanto o usu�rio est� na p�gina.
      --------------------------------------------------------------- */
      let cart = []; // Array de itens: { id, name, price, qty, img }
      const geocodeCache = new Map();
      const deliveryState = {
        distanceKm: 0,
        fee: 0,
        isCalculating: false,
        lastCalculatedAddress: '',
        requestId: 0
      };
      let deliveryDebounceTimer = null;

      /** Adiciona item ao carrinho. Se j� existe, incrementa a quantidade. */
      function addToCart(product, qty = 1) {
        const existing = cart.find(i => i.id === product.id);
        if (existing) {
          existing.qty += qty;
        } else {
          cart.push({ id: product.id, name: product.name, price: product.price, qty, img: product.img || null });
        }
        updateCartUI();
        toast(`? ${product.name} adicionado ao carrinho!`);
      }

      /** Remove item completamente do carrinho */
      function removeFromCart(id) {
        cart = cart.filter(i => i.id !== id);
        updateCartUI();
        renderCartBody();
      }

      /** Altera a quantidade de um item (m�nimo 1) */
      function changeCartQty(id, delta) {
        const item = cart.find(i => i.id === id);
        if (!item) return;
        item.qty = Math.max(1, item.qty + delta);
        updateCartUI();
        renderCartBody();
      }

      /** Calcula o subtotal do carrinho */
      function getCartSubtotal() {
        return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
      }

      function formatDistanceKm(distanceKm) {
        const safe = Number(distanceKm);
        if (!Number.isFinite(safe) || safe <= 0) return '-- km';
        return `${safe.toFixed(1).replace('.', ',')} km`;
      }

      function setDeliveryStatus(message, type = 'neutral') {
        const el = document.getElementById('cart-delivery-status');
        if (!el) return;
        el.textContent = message;
        el.classList.remove('error', 'success');
        if (type === 'error' || type === 'success') el.classList.add(type);
      }

      function setDeliveryLoading(isLoading) {
        deliveryState.isCalculating = isLoading;
        const btn = document.getElementById('cart-calc-delivery-btn');
        if (!btn) return;
        btn.disabled = isLoading;
        btn.textContent = isLoading ? 'Calculando...' : 'Calcular entrega';
      }

      function clearDeliveryCalculation(statusMessage = 'Digite o endere?o para calcular automaticamente') {
        deliveryState.distanceKm = 0;
        deliveryState.fee = 0;
        deliveryState.lastCalculatedAddress = '';
        setDeliveryStatus(statusMessage);
        updateOrderSummary();
      }

      function getStoreAddress() {
        return (CONFIG.addr || STORE_ADDRESS || '').trim();
      }

      async function geocodeAddress(address) {
        const normalized = String(address || '').trim();
        console.log('[GEOCODE] Geocodificando:', normalized);
        if (!normalized) throw new Error('Informe um endere?o v?lido.');

        const cacheKey = normalized.toLowerCase();
        if (geocodeCache.has(cacheKey)) {
          const cached = geocodeCache.get(cacheKey);
          console.log('[GEOCODE] Usando cache:', cached);
          return cached;
        }

        const query = encodeURIComponent(`${normalized}, Brasil`);
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`;

        console.log('[GEOCODE] Chamando Nominatim:', url);

        let resp;
        try {
          resp = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
        } catch (_) {
          throw new Error('N?o foi poss?vel consultar o mapa agora. Tente novamente.');
        }

        if (!resp.ok) throw new Error('Falha ao validar o endere?o. Tente novamente.');
        const data = await resp.json();
        console.log('[GEOCODE] Resposta Nominatim:', data);

        if (!Array.isArray(data) || !data.length) {
          throw new Error('Endere?o n?o encontrado. Confira: ' + normalized);
        }

        const coords = {
          lat: Number(data[0].lat),
          lon: Number(data[0].lon)
        };

        if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) {
          throw new Error('Endere?o inv?lido. Tente informar mais detalhes.');
        }

        console.log('[GEOCODE] Coordenadas encontradas:', coords);
        geocodeCache.set(cacheKey, coords);
        return coords;
      }

      async function routeDistanceWithOpenRouteService(originCoords, destinationCoords) {
        if (!MAPS_API_KEY || MAPS_API_KEY === 'SUA_CHAVE_AQUI') return null;

        const start = `${originCoords.lon},${originCoords.lat}`;
        const end = `${destinationCoords.lon},${destinationCoords.lat}`;
        const url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${start}&end=${end}`;

        try {
          const resp = await fetch(url, {
            headers: { Authorization: MAPS_API_KEY }
          });
          if (!resp.ok) return null;
          const data = await resp.json();
          const meters = data?.features?.[0]?.properties?.summary?.distance;
          if (!Number.isFinite(meters) || meters <= 0) return null;
          return meters / 1000;
        } catch (_) {
          return null;
        }
      }

      async function routeDistanceWithOsrm(originCoords, destinationCoords) {
        const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destinationCoords.lon},${destinationCoords.lat}?overview=false&alternatives=false&steps=false`;

        let resp;
        try {
          resp = await fetch(url);
        } catch (_) {
          throw new Error('Não foi possível calcular a rota agora. Tente novamente.');
        }

        if (!resp.ok) throw new Error('Falha ao calcular a rota. Tente novamente.');
        const data = await resp.json();
        const meters = data?.routes?.[0]?.distance;
        if (!Number.isFinite(meters) || meters <= 0) {
          throw new Error('N?o encontramos rota vi?ria para esse endere?o.');
        }
        return meters / 1000;
      }

      async function calculateDistance(origin, destination) {
        console.log('[DISTANCE] Calculateando distância entre:', origin, 'e', destination);
        const [originCoords, destinationCoords] = await Promise.all([
          geocodeAddress(origin),
          geocodeAddress(destination)
        ]);

        console.log('[DISTANCE] Coordenadas origem:', originCoords, 'destino:', destinationCoords);

        const orsKm = await routeDistanceWithOpenRouteService(originCoords, destinationCoords);
        const distanceKm = orsKm || await routeDistanceWithOsrm(originCoords, destinationCoords);
        console.log('[DISTANCE] Distância final:', distanceKm, 'km');
        return Number(distanceKm.toFixed(2));
      }

      function calculateDeliveryFee(distance) {
        const distanceKm = Number(distance) || 0;
        if (distanceKm <= 0) return 0;

        let fee = distanceKm * DELIVERY_FEE_PER_KM;

        // Regras futuras (desligadas por padr?o)
        if (DELIVERY_RULES.enforceMinFee) fee = Math.max(fee, MIN_DELIVERY_FEE);
        if (DELIVERY_RULES.enableFreeDeliveryOver && getCartSubtotal() >= FREE_DELIVERY_OVER) fee = 0;
        if (DELIVERY_RULES.enforceMaxDistance && distanceKm > MAX_DELIVERY_DISTANCE_KM) {
          throw new Error(`Atendemos at? ${MAX_DELIVERY_DISTANCE_KM} km de dist?ncia.`);
        }

        return Number(fee.toFixed(2));
      }

      function updateOrderSummary() {
        const subtotal = getCartSubtotal();
        const fee = deliveryState.fee || 0;
        const total = subtotal + fee;

        const subtotalEl = document.getElementById('cart-subtotal');
        const distanceEl = document.getElementById('cart-distance-km');
        const feePerKmEl = document.getElementById('cart-fee-per-km');
        const feeEl = document.getElementById('cart-delivery-fee');
        const totalEl = document.getElementById('cart-total');
        const feeDisplayEl = document.getElementById('cart-fee-display');

        if (subtotalEl) subtotalEl.textContent = `R$ ${fmtPrice(subtotal)}`;
        if (distanceEl) distanceEl.textContent = formatDistanceKm(deliveryState.distanceKm);
        if (feePerKmEl) feePerKmEl.textContent = `R$ ${fmtPrice(DELIVERY_FEE_PER_KM)}`;
        if (feeEl) feeEl.textContent = `R$ ${fmtPrice(fee)}`;
        if (totalEl) totalEl.textContent = `R$ ${fmtPrice(total)}`;
        if (feeDisplayEl) feeDisplayEl.textContent = `Taxa de entrega: R$ ${fmtPrice(fee)}`;
      }

      function calcDeliveryFee() {
        return calculateDeliveryFee(deliveryState.distanceKm);
      }

      function updateDeliveryFee() {
        updateOrderSummary();
      }

      function scheduleDeliveryCalculation() {
        const input = document.getElementById('cart-address');
        if (!input) return;

        const destination = input.value.trim();
        if (!destination) {
          if (deliveryDebounceTimer) clearTimeout(deliveryDebounceTimer);
          clearDeliveryCalculation('Digite o endere?o para calcular automaticamente');
          return;
        }

        if (destination !== deliveryState.lastCalculatedAddress) {
          deliveryState.distanceKm = 0;
          deliveryState.fee = 0;
          updateOrderSummary();
        }

        setDeliveryStatus('Calculando automaticamente...');
        if (deliveryDebounceTimer) clearTimeout(deliveryDebounceTimer);
        deliveryDebounceTimer = setTimeout(() => {
          calculateDeliveryFromCart();
        }, 850);
      }

      async function calculateDeliveryFromCart(options = {}) {
        const { showFeedback = false, force = false } = options;
        const input = document.getElementById('cart-address');
        const destination = input?.value?.trim() || '';
        const origin = getStoreAddress();

        console.log('[DELIVERY] Iniciando cálculo:', { origin, destination, force });

        if (!origin) {
          setDeliveryStatus('Endere?o da loja n?o configurado.', 'error');
          console.error('[DELIVERY] Erro: Endereço da loja não configurado');
          return null;
        }
        if (!destination) {
          setDeliveryStatus('Informe seu endere?o de entrega.', 'error');
          return null;
        }
        if (!force && destination === deliveryState.lastCalculatedAddress && deliveryState.distanceKm > 0) {
          console.log('[DELIVERY] Usando cache');
          return { distanceKm: deliveryState.distanceKm, fee: deliveryState.fee };
        }

        const reqId = ++deliveryState.requestId;
        setDeliveryLoading(true);
        setDeliveryStatus('Calculando rota...');

        try {
          console.log('[DELIVERY] Calculando distância de:', origin, 'para:', destination);
          const distanceKm = await calculateDistance(origin, destination);
          const fee = calculateDeliveryFee(distanceKm);

          console.log('[DELIVERY] Distância calculada:', distanceKm, 'km, Taxa:', fee);

          if (reqId !== deliveryState.requestId) return null;

          deliveryState.distanceKm = distanceKm;
          deliveryState.fee = fee;
          deliveryState.lastCalculatedAddress = destination;
          setDeliveryStatus('Dist?ncia calculada com sucesso.', 'success');
          updateOrderSummary();
          if (showFeedback) toast(`?? Dist?ncia: ${formatDistanceKm(distanceKm)} ? Taxa: R$ ${fmtPrice(fee)}`);
          return { distanceKm, fee };
        } catch (err) {
          console.error('[DELIVERY] Erro ao calcular:', err);
          if (reqId !== deliveryState.requestId) return null;
          deliveryState.distanceKm = 0;
          deliveryState.fee = 0;
          deliveryState.lastCalculatedAddress = '';
          const msg = String(err?.message || 'Erro ao calcular a entrega.');
          setDeliveryStatus(msg, 'error');
          updateOrderSummary();
          if (showFeedback) toast(`?? ${msg}`);
          return null;
        } finally {
          if (reqId === deliveryState.requestId) setDeliveryLoading(false);
        }
      }

      /** Atualiza o badge do carrinho no header e os totais */
      function updateCartUI() {
        const totalQty = cart.reduce((s, i) => s + i.qty, 0);
        const badge = document.getElementById('cart-badge');
        badge.textContent = totalQty;
        badge.classList.toggle('hidden', totalQty === 0);
        updateOrderSummary();
      }

      /** Renderiza a lista de itens dentro do painel do carrinho */
      function renderCartBody() {
        const body = document.getElementById('cart-body');
        const addrSec = document.getElementById('cart-address-section');
        const totals = document.getElementById('cart-totals');
        const form = document.getElementById('cart-form');

        if (cart.length === 0) {
          body.innerHTML = '<div class="cart-empty"><span>??</span><p>Seu carrinho está vazio.<br>Adicione itens do cardápio!</p></div>';
          addrSec.style.display = 'none';
          totals.style.display = 'none';
          form.style.display = 'none';
          clearDeliveryCalculation();
          return;
        }

        body.innerHTML = cart.map(item => `
          <div class="cart-item">
            <div class="cart-item-img">
              ${item.img ? `<img src="${item.img}" alt="${esc(item.name)}">` : '??'}
            </div>
            <div class="cart-item-info">
              <div class="cart-item-name">${esc(item.name)}</div>
              <div class="cart-item-price">R$ ${fmtPrice(item.price * item.qty)} (${item.qty}x R$ ${fmtPrice(item.price)})</div>
            </div>
            <div class="cart-item-ctrl">
              <button class="cart-qty-btn" onclick="changeCartQty(${item.id}, -1)">-</button>
              <span class="cart-qty-n">${item.qty}</span>
              <button class="cart-qty-btn" onclick="changeCartQty(${item.id}, +1)">+</button>
              <button class="cart-remove-btn" onclick="removeFromCart(${item.id})" title="Remover">??</button>
            </div>
          </div>
        `).join('');

        addrSec.style.display = 'block';
        totals.style.display = 'block';
        form.style.display = 'block';
        updateCartUI();
      }

      function openCart() {
        renderCartBody();
        document.getElementById('cart-overlay').classList.add('open');
        document.body.classList.add('overlay-open');
      }

      function closeCart() {
        document.getElementById('cart-overlay').classList.remove('open');
        document.body.classList.remove('overlay-open');
      }

      /* --- ADICIONAR DO MODAL --- */
      let curModal = null, modalQty = 1;

      function addToCartFromModal() {
        if (!curModal) return;
        addToCart(curModal, modalQty);
        document.getElementById('modal-overlay').classList.remove('open');
      }

      /* ---------------------------------------------------------------
         CHECKOUT � CRIA��O DO PEDIDO
      --------------------------------------------------------------- */
      let currentFlowOrder = null;

      /** Gera n�mero de pedido sequencial baseado no banco */
      async function generateOrderNumber() {
        const { data, error } = await sb.from('pb_orders').select('id').order('id', { ascending: false }).limit(1);
        if (error) throw error;
        const nextId = data && data.length ? data[0].id + 1 : 1;
        return '#' + String(nextId).padStart(4, '0');
      }

      /**
       * Gera um c�digo �nico de 6 caracteres para confirma��o de entrega.
       * O entregador pedir� este c�digo ao cliente para marcar como "Entregue".
       */
      function generateDeliveryCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem chars confusos (0,O,I,1)
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
      }

      /** Inicia o processo de checkout � valida dados e cria pedido no banco */
      async function startCheckout() {
        if (cart.length === 0) { toast('? Adicione itens ao carrinho!'); return; }

        const name    = document.getElementById('cart-name').value.trim();
        const phone   = document.getElementById('cart-phone').value.trim();
        const address = document.getElementById('cart-address').value.trim();
        const notes   = document.getElementById('cart-notes').value.trim();

        if (!name)    { toast('? Informe seu nome.'); return; }
        if (!phone)   { toast('? Informe seu telefone.'); return; }
        if (!address) { toast('? Informe o endereço de entrega.'); return; }

        const btn = document.getElementById('cart-checkout-btn');
        btn.disabled = true;
        btn.textContent = '⏳ Calculando entrega...';

        try {
          console.log('[CHECKOUT] Iniciando processo de checkout');
          console.log('[CHECKOUT] Endereço da loja:', STORE_ADDRESS);
          console.log('[CHECKOUT] Endereço do cliente:', address);

          const distanceData = await calculateDeliveryFromCart({ force: true });
          console.log('[CHECKOUT] Resultado do cálculo de entrega:', distanceData);

          if (!distanceData || distanceData.distanceKm === undefined) {
            toast('? Não foi possível calcular a entrega. Revise o endereço e tente novamente.');
            return;
          }

          btn.textContent = '⏳ Criando pedido...';

          const km = distanceData.distanceKm;
          const subtotal    = getCartSubtotal();
          const deliveryFee = distanceData.fee;
          const total       = subtotal + deliveryFee;
          const orderNumber = await generateOrderNumber();
          const deliveryCode = generateDeliveryCode();

          const items = cart.map(i => ({ name: i.name, price: i.price, quantity: i.qty }));

          console.log('[CHECKOUT] Criando pedido:', { orderNumber, name, phone, address, subtotal, deliveryFee, total });

      console.log("=== DADOS REAIS ENVIADOS AO BANCO ===");

console.log({
  order_number: orderNumber,
  customer_name: name,
  customer_phone: phone,
  customer_address: address,
  items,
  subtotal,
  delivery_fee: deliveryFee,
  distance_km: km,
  total,
  payment_method: 'pending',
  payment_status: 'pending',
  status: 'pending',
  delivery_code: deliveryCode,
  deliverer_confirmed: false,
  customer_confirmed: false,
  notes
});

// Cria o pedido com status "pending"
const { data, error } = await sb
  .from('pb_orders')
  .insert({
    order_number: orderNumber,
    customer_name: name,
    customer_phone: phone,
    customer_address: address,

    // IMPORTANTE: não usar JSON.stringify
    items: items,

    subtotal,
    delivery_fee: deliveryFee,
    distance_km: km,
    total,

    payment_method: 'pending',
    payment_status: 'pending',
    status: 'pending',

    delivery_code: deliveryCode,
    deliverer_confirmed: false,
    customer_confirmed: false,

    notes
  })
  .select();

if (error) {
  console.error("ERRO COMPLETO:");
  console.log(error);
  console.log(error.message);
  console.log(error.details);
  console.log(error.hint);
  throw error;
}

        const createdOrder = Array.isArray(data) ? data[0] : data;
          console.log('[CHECKOUT] Pedido criado com sucesso:', createdOrder);
          currentFlowOrder = createdOrder;
          closeCart();
          openMpOverlay(createdOrder);
        } catch (err) {
          console.error('[CHECKOUT] Erro no checkout:', err);
          const msg = String(err?.message || err || 'Erro desconhecido');
          if (msg.includes('pb_orders')) {
            toast('? Tabela pb_orders não configurada. Veja o console para mais detalhes.');
          } else if (msg.includes('relation "pb_orders" does not exist')) {
            toast('? Execute setup_supabase.sql no seu banco de dados primeiro!');
          } else if (msg.includes('endereço') || msg.includes('rota')) {
            toast('? ' + msg);
          } else {
            toast('? Erro: ' + msg);
          }
        } finally {
          btn.disabled = false;
          btn.textContent = '?? Finalizar e pagar online';
        }
      }

      /* ---------------------------------------------------------------
         INTEGRA��O MERCADO PAGO
         -------------------------------------------------------------
         O Mercado Pago oferece "Bricks" � componentes visuais prontos
         que renderizam o formul�rio de pagamento com seguran�a.

         FLUXO COMPLETO (com backend):
         1. Frontend cria prefer�ncia via POST no seu backend
         2. Backend chama API MP com ACCESS_TOKEN e retorna preference_id
         3. Frontend usa preference_id para renderizar o Brick
         4. Ap�s pagamento, MP envia webhook para seu backend
         5. Backend atualiza o status do pedido no Supabase

         FLUXO SIMPLIFICADO (atual � sem backend):
         1. Usa o CardPaymentBrick diretamente no frontend
         2. Ao approvar, atualiza o pedido no Supabase
         -------------------------------------------------------------
         WEBHOOK PARA SEU BACKEND:
         POST /mp-webhook
         { "type": "payment", "data": { "id": "PAYMENT_ID" } }

         No backend, busque o pagamento:
         GET https://api.mercadopago.com/v1/payments/{id}
         Header: Authorization: Bearer SEU_ACCESS_TOKEN
      --------------------------------------------------------------- */
      let mpInstance = null;

      function openMpOverlay(order) {
        const orderObj = Array.isArray(order) ? order[0] : order;
        if (!orderObj) return;
        currentFlowOrder = orderObj;

        // Renderiza resumo do pedido
        renderMpOrderSummary(orderObj);

        // Mostra a tela de pagamento, esconde sucesso
        document.getElementById('mp-payment-view').style.display = 'block';
        document.getElementById('mp-success-view').style.display = 'none';
        document.getElementById('mp-overlay').classList.add('open');

        if (DEMO_MODE) {
          // Modo demonstra��o � sem credenciais reais
          document.getElementById('cardPaymentBrick_container').style.display = 'none';
          document.getElementById('mp-simulation-mode').style.display = 'block';
        } else {
          // Modo real � inicializa o Brick do Mercado Pago
          document.getElementById('cardPaymentBrick_container').style.display = 'block';
          document.getElementById('mp-simulation-mode').style.display = 'none';
          initMpBrick(order);
        }
      }

      /** Renderiza o Brick de pagamento do Mercado Pago */
      async function initMpBrick(order) {
        try {
          // Limpa inst�ncia anterior se existir
          if (mpInstance) { try { await mpInstance.unmount(); } catch(_){} mpInstance = null; }

          // Inicializa o SDK do Mercado Pago com sua Public Key
          const mp = new MercadoPago(MERCADO_PAGO_PUBLIC_KEY, { locale: 'pt-BR' });
          const bricksBuilder = mp.bricks();

          // Renderiza o CardPaymentBrick
          mpInstance = await bricksBuilder.create('cardPayment', 'cardPaymentBrick_container', {
            initialization: {
              amount: order.total, // Valor total do pedido
              payer: {
                email: '', // Pode preencher com email do cliente se dispon�vel
              }
            },
            customization: {
              visual: {
                style: {
                  theme: 'dark', // Tema escuro combina com o site
                }
              }
            },
            callbacks: {
              onReady: () => {
                // Brick carregado e pronto para uso
                console.log('MP Brick pronto');
              },
              onSubmit: async (cardFormData) => {
                // Chamado quando o usu�rio clica em "Pagar"
                // IMPORTANTE: Em produ��o, envie cardFormData ao SEU BACKEND
                // O backend processa o pagamento com o ACCESS_TOKEN secreto
                // e retorna o resultado.

                // Exemplo de chamada ao backend (implemente conforme seu servidor):
                /*
                const response = await fetch('/api/process-payment', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    token:         cardFormData.token,
                    issuer_id:     cardFormData.issuer_id,
                    payment_method_id: cardFormData.payment_method_id,
                    transaction_amount: order.total,
                    installments:  cardFormData.installments,
                    order_id:      order.id,
                    payer: { email: cardFormData.payer.email }
                  })
                });
                const result = await response.json();
                if (result.status === 'approved') onMpPaymentApproved(result.id);
                else onMpPaymentRejected(result.status_detail);
                */

                // Por enquanto (sem backend), simula aprova��o
                console.log('Dados do cartão (enviar ao backend):', cardFormData);
                await onMpPaymentApproved('PAYMENT_' + Date.now());
              },
              onError: (error) => {
                console.error('MP Brick erro:', error);
                toast('? Erro no formulário de pagamento. Tente novamente.');
              }
            }
          });
        } catch (e) {
          console.error('Erro ao inicializar Mercado Pago:', e);
          // Cai para modo de simula��o se o Brick falhar
          document.getElementById('cardPaymentBrick_container').style.display = 'none';
          document.getElementById('mp-simulation-mode').style.display = 'block';
        }
      }

      /** Simula��o de pagamento para testes sem conta Mercado Pago */
      async function simulateMpPayment() {
        const result = document.getElementById('mp-sim-result')?.value || 'approved';
        toast('Processando pagamento de simulação...');
        console.log('[MP SIM] Simulação acionada:', result, currentFlowOrder);
        if (result === 'approved') {
          await onMpPaymentApproved('SIMULATED_' + Date.now());
        } else {
          toast('? Pagamento recusado (simulação). Tente outro cartão.');
        }
      }

      /** Chamado quando o pagamento � APROVADO pelo Mercado Pago */
      async function onMpPaymentApproved(paymentId) {
        if (!currentFlowOrder) {
          toast('? Pedido não encontrado para confirmação de pagamento.');
          return;
        }

        const updatePayload = {
          payment_method: 'mercadopago',
          payment_status: 'paid',
          status:         'paid',
          mp_payment_id:  String(paymentId)
        };

        let query = sb.from('pb_orders').update(updatePayload);
        if (currentFlowOrder.id) {
          query = query.eq('id', currentFlowOrder.id);
        } else if (currentFlowOrder.order_number) {
          query = query.eq('order_number', currentFlowOrder.order_number);
        } else {
          toast('? Pedido não tem ID ou número para atualização.');
          return;
        }

        const { error } = await query;
        if (error) {
          console.error('[MP] Erro ao atualizar pagamento:', error);
          toast('? Erro ao confirmar pagamento. Tente novamente.');
          return;
        }

        currentFlowOrder = { ...currentFlowOrder, ...updatePayload };

        // Limpa o carrinho ap�s pedido confirmado
        cart = [];
        const addrInput = document.getElementById('cart-address');
        const nameInput = document.getElementById('cart-name');
        const phoneInput = document.getElementById('cart-phone');
        const notesInput = document.getElementById('cart-notes');
        if (addrInput) addrInput.value = '';
        if (nameInput) nameInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (notesInput) notesInput.value = '';
        clearDeliveryCalculation();
        updateCartUI();

        // Mostra tela de sucesso
        document.getElementById('mp-payment-view').style.display = 'none';
        document.getElementById('mp-success-view').style.display = 'block';
        document.getElementById('mp-success-text').textContent =
          `Pedido ${currentFlowOrder.order_number} confirmado! Guarde seu número para rastreamento.`;

        toast('?? Pedido pago e confirmado!');
      }

      function getOrderFeePerKm(order) {
        const distance = Number(order?.distance_km) || 0;
        const fee = Number(order?.delivery_fee) || 0;
        if (distance > 0) return Number((fee / distance).toFixed(2));
        return DELIVERY_FEE_PER_KM;
      }

      function renderMpOrderSummary(order) {
        const items = parseOrderItems(order.items);
        const feePerKm = getOrderFeePerKm(order);
        const rows = items.map(i =>
          `<div class="mp-item-row"><span>${i.quantity || 1}x ${esc(i.name)}</span><span>R$ ${fmtPrice((i.price||0) * (i.quantity||1))}</span></div>`
        ).join('');
        document.getElementById('mp-order-summary').innerHTML = `
          <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--gold);margin-bottom:8px;">${order.order_number}</div>
          ${rows}
          <div class="mp-item-row" style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(245,166,35,.2);">
            <span>Distância</span><span>${formatDistanceKm(order.distance_km)}</span>
          </div>
          <div class="mp-item-row"><span>Taxa por KM</span><span>R$ ${fmtPrice(feePerKm)}</span></div>
          <div class="mp-item-row"><span>Taxa de entrega</span><span>R$ ${fmtPrice(order.delivery_fee||0)}</span></div>
          <div class="grand-total">Total: R$ ${fmtPrice(order.total||0)}</div>`;
      }

      function closeMpOverlay() {
        document.getElementById('mp-overlay').classList.remove('open');
        if (mpInstance) { try { mpInstance.unmount(); } catch(_){} mpInstance = null; }
      }

      function openTrackFromPayment() {
        closeMpOverlay();
        openTrackOverlay(currentFlowOrder?.order_number || '');
      }

      /* ---------------------------------------------------------------
         RASTREAMENTO DO PEDIDO
      --------------------------------------------------------------- */
      let currentTrackOrder = null, trackPolling = null;

      function openTrackOverlay(orderNumber = '') {
        document.getElementById('track-overlay').classList.add('open');
        document.getElementById('track-busca').style.display = 'block';
        document.getElementById('track-timeline').style.display = 'none';
        const input = document.getElementById('track-order-input');
        input.value = orderNumber ? normalizeOrderNumber(orderNumber) : '';
        if (input.value) searchTrackOrder(false);
        else input.focus();
      }

      function closeTrackOverlay() {
        document.getElementById('track-overlay').classList.remove('open');
        stopTrackPolling();
      }

      function stopTrackPolling() {
        if (trackPolling) clearInterval(trackPolling);
        trackPolling = null;
      }

      async function searchTrackOrder(showToast = true) {
        const n = normalizeOrderNumber(document.getElementById('track-order-input').value);
        if (!n) { if (showToast) toast('Digite o número do pedido.'); return; }
        const { data, error } = await sb.from('pb_orders').select('*').eq('order_number', n).single();
        if (error || !data) { if (showToast) toast('Pedido não encontrado.'); return; }
        currentTrackOrder = n;
        renderTrackOrder(data);
        document.getElementById('track-busca').style.display = 'none';
        document.getElementById('track-timeline').style.display = 'block';
        stopTrackPolling();
        // Atualiza��o autom�tica a cada 15 segundos
        trackPolling = setInterval(async () => {
          if (!currentTrackOrder) return;
          const { data: latest } = await sb.from('pb_orders').select('*').eq('order_number', currentTrackOrder).single();
          if (latest) renderTrackOrder(latest);
        }, 15000);
      }

      /* -------------------------------------------------------------
         STATUS DO PEDIDO:
         pending    ? Aguardando pagamento
         paid       ? Pago � aguardando preparo
         preparing  ? Em preparo na cozinha
         on_the_way ? Saiu para entrega
         delivered  ? Entregue (requer confirma��o dupla)
         cancelled  ? Cancelado
      ------------------------------------------------------------- */
      const ORDER_STEPS = [
        { key: 'pending',    icon: '??', label: 'Pagamento' },
        { key: 'paid',       icon: '?', label: 'Pago'       },
        { key: 'preparing',  icon: '?????', label: 'Em preparo' },
        { key: 'on_the_way', icon: '???', label: 'A caminho'  },
        { key: 'delivered',  icon: '??', label: 'Entregue'   },
      ];

      function renderTrackOrder(order) {
        const si = ORDER_STEPS.findIndex(s => s.key === order.status);
        let timelineHtml = '<div class="timeline">';
        ORDER_STEPS.forEach((step, i) => {
          const state = i < si ? 'done' : i === si ? 'active' : 'pending';
          const icon  = i < si ? '?' : step.icon;
          timelineHtml += `<div class="timeline-step">
            ${i < ORDER_STEPS.length - 1 ? `<div class="timeline-line ${i < si ? 'done' : 'pending'}"></div>` : ''}
            <div class="timeline-icon ${state}" style="z-index:1">${icon}</div>
            <div class="timeline-label ${state}">${step.label}</div>
          </div>`;
        });
        timelineHtml += '</div>';

        // C�digo de entrega � exibido quando o pedido est� a caminho
        let deliveryCodeHtml = '';
        if (order.status === 'on_the_way' && order.delivery_code) {
          deliveryCodeHtml = `
            <div class="delivery-code-box">
              <div class="delivery-code-label">?? Código de confirmação de entrega</div>
              <div class="delivery-code-value">${order.delivery_code}</div>
              <div class="delivery-code-hint">
                Forneça este código ao entregador para confirmar o recebimento.<br>
                Sem este código, o pedido não será marcado como entregue.
              </div>
            </div>`;
        }

        // Itens do pedido
        const items = parseOrderItems(order.items);
        const itemRows = items.map(it =>
          `<div class="item-row"><span>${it.quantity||1}x ${esc(it.name)}</span><span class="item-price">R$ ${fmtPrice((it.price||0)*(it.quantity||1))}</span></div>`
        ).join('');

        const html = `
          <div class="card">
            <div class="flex-between" style="margin-bottom:8px;">
              <span style="font-family:'Bebas Neue',sans-serif;font-size:36px;color:var(--gold);">${order.order_number}</span>
              <span class="badge badge-${order.status||'pending'}">${statusLabel(order.status)}</span>
            </div>
            <div class="text-gray" style="font-size:12px;">${fmtDate(order.created_at)}</div>
            ${timelineHtml}
            ${deliveryCodeHtml}
          </div>
          <div class="card mt-16">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--gold);margin-bottom:4px;">Itens do pedido</div>
            <div class="items-list">${itemRows}</div>
            <div class="totals-box">
              <div class="total-row"><span>Subtotal</span><span>R$ ${fmtPrice(order.subtotal||0)}</span></div>
              <div class="total-row">
                <span>Taxa de entrega ${order.distance_km ? `(${formatDistanceKm(order.distance_km)} × R$ ${fmtPrice(getOrderFeePerKm(order))}/km)` : ''}</span>
                <span>R$ ${fmtPrice(order.delivery_fee||0)}</span>
              </div>
              <div class="total-row grand"><span>Total</span><span>R$ ${fmtPrice(order.total||0)}</span></div>
            </div>
            <div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between;">
              <span class="text-gray" style="font-size:13px;">Pagamento: <strong>${paymentMethodLabel(order.payment_method)}</strong></span>
              <span class="badge badge-${order.payment_status==='paid'?'confirmed':'pending'}">${order.payment_status==='paid'?'Pago':'Pendente'}</span>
            </div>
            ${order.customer_address ? `<div style="margin-top:8px;font-size:13px;">?? ${esc(order.customer_address)}</div>` : ''}
          </div>
          <div class="sync-indicator" style="justify-content:center;margin-top:12px;">
            <div class="sync-dot"></div><span>Atualizando a cada 15s</span>
          </div>
          <button class="btn-outline" onclick="document.getElementById('track-busca').style.display='block';document.getElementById('track-timeline').style.display='none';stopTrackPolling();">
            ? Rastrear outro pedido
          </button>`;

        document.getElementById('track-result').innerHTML = html;
      }

      /* ---------------------------------------------------------------
         CAROUSEL DE BANNERS
      --------------------------------------------------------------- */
      let carouselIdx = 0, carouselTimer;

      function renderCarousel() {
        const track = document.getElementById('carousel-track');
        const dots  = document.getElementById('carousel-dots');
        track.innerHTML = BANNERS.map(b => `
          <div class="slide">
            <div class="slide-bg"></div>
            ${b.img ? `<img class="slide-img-cover" src="${b.img}" alt="">` : ''}
            <div class="slide-content">
              <div class="slide-text">
                <div class="slide-badge ${b.badge_type==='green'?'green':b.badge_type==='red'?'red':''}">${b.badge||''}</div>
                <div class="slide-title">${b.title_highlight ? `<span>${b.title_highlight}</span>${b.title.replace(b.title_highlight,'')}` : b.title}</div>
                <div class="slide-sub">${b.sub||''}</div>
              </div>
            </div>
          </div>`).join('');
        dots.innerHTML = BANNERS.map((_,i) => `<div class="cdot ${i===0?'active':''}" onclick="goSlide(${i})"></div>`).join('');
        carouselIdx = 0;
        startCarousel();
      }

      function goSlide(i) {
        carouselIdx = (i + BANNERS.length) % BANNERS.length;
        document.getElementById('carousel-track').style.transform = `translateX(-${carouselIdx*100}%)`;
        document.querySelectorAll('.cdot').forEach((d,j) => d.classList.toggle('active', j === carouselIdx));
      }

      function startCarousel() {
        clearInterval(carouselTimer);
        carouselTimer = setInterval(() => goSlide(carouselIdx + 1), 4500);
      }

      /* ---------------------------------------------------------------
         RENDERIZA��O DE PRODUTOS
      --------------------------------------------------------------- */
      let curCat = 'all';

      function renderProducts(filter = 'all', search = '') {
        const feat = PRODUCTS.filter(p => p.feat && (filter === 'all' || filter === p.cat) && matchSearch(p, search));
        const all  = PRODUCTS.filter(p => (filter === 'all' || filter === p.cat) && matchSearch(p, search) && p.cat !== 'extra');
        const fsec = document.getElementById('feat-section');
        const fs   = document.getElementById('feat-scroll');
        fsec.style.display = feat.length ? 'block' : 'none';
        fs.innerHTML = feat.map(p => `
          <div class="feat-card" onclick="openModal(${p.id})">
            ${p.tag ? `<span class="feat-badge ${p.tag==='hit'?'hit':p.tag==='novo'?'novo':'esp'}">${tagLabel(p.tag)}</span>` : ''}
            <div class="feat-img">${p.img ? `<img src="${p.img}" alt="${esc(p.name)}" loading="lazy">` : '<span style="font-size:44px">??</span>'}</div>
            <div class="feat-info">
              <h4>${esc(p.name)}</h4><p>${esc(p.descr)}</p>
              <div class="feat-footer">
                <div class="price">R$${fmtPrice(p.price)}</div>
                <button class="add-btn" onclick="event.stopPropagation();addToCart(PRODUCTS.find(x=>x.id===${p.id}))">+</button>
              </div>
            </div>
          </div>`).join('');
        initPhysicsScroll(fs);
        const ml = document.getElementById('menu-list');
        ml.innerHTML = all.map(p => `
          <div class="menu-item" onclick="openModal(${p.id})">
            <div class="mi-img">${p.img ? `<img src="${p.img}" alt="${esc(p.name)}" loading="lazy">` : '??'}</div>
            <div class="mi-body">
              <div>
                <div class="mi-name">${esc(p.name)}</div>
                <div class="mi-desc">${esc(p.descr)}</div>
                ${p.tag ? `<div class="mi-tags"><span class="tag ${p.tag==='hit'?'tag-h':p.tag==='novo'?'tag-n':'tag-s'}">${tagLabel(p.tag)}</span></div>` : ''}
              </div>
              <div class="mi-bottom">
                <div class="mi-price">R$${fmtPrice(p.price)}</div>
                <button class="mi-add" onclick="event.stopPropagation();addToCart(PRODUCTS.find(x=>x.id===${p.id}))">+</button>
              </div>
            </div>
          </div>`).join('');
        if (!all.length) ml.innerHTML = `<div style="padding:30px;text-align:center;color:var(--gray);font-weight:700;">Nenhum item encontrado.</div>`;
      }

      /* --- MODAL DE PRODUTO --- */
      function openModal(id) {
        const p = PRODUCTS.find(x => x.id === id);
        if (!p) return;
        curModal = p; modalQty = 1;
        document.getElementById('modal-name').textContent = p.name;
        document.getElementById('modal-desc').textContent = p.descr;
        document.getElementById('modal-price').textContent = `R$${fmtPrice(p.price)}`;
        document.getElementById('modal-qty').textContent = 1;
        document.getElementById('modal-img-box').innerHTML = p.img
          ? `<img src="${p.img}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover">`
          : `<span style="font-size:90px">??</span>`;
        document.getElementById('modal-ings').innerHTML = (p.descr||'').split('·').map(s=>s.trim()).filter(Boolean).map(i=>`<span class="ing-chip">${esc(i)}</span>`).join('');
        document.getElementById('modal-overlay').classList.add('open');
      }

      function closeModal(e) {
        if (e.target === document.getElementById('modal-overlay')) document.getElementById('modal-overlay').classList.remove('open');
      }

      function changeQty(d) {
        modalQty = Math.max(1, modalQty + d);
        document.getElementById('modal-qty').textContent = modalQty;
      }

      /* --- FILTROS --- */
      function filterCat(cat, btn) {
        curCat = cat;
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderProducts(cat, document.getElementById('search-input').value.toLowerCase());
      }

      function filterMenu(q) {
        renderProducts(curCat, q.toLowerCase());
      }

      function matchSearch(p, s) {
        return !s || p.name.toLowerCase().includes(s) || (p.descr||'').toLowerCase().includes(s);
      }

      /* --- ADMIN --- */
      function openAdminGate() {
        document.getElementById('admin-pw-input').value = '';
        document.getElementById('login-error').style.display = 'none';
        document.getElementById('login-overlay').classList.add('open');
        setTimeout(() => document.getElementById('admin-pw-input').focus(), 100);
      }

      function checkLogin() {
        const pw = document.getElementById('admin-pw-input').value;
        if (pw === CONFIG.pw) {
          document.getElementById('login-overlay').classList.remove('open');
          openAdminPanel();
        } else {
          document.getElementById('login-error').style.display = 'block';
          document.getElementById('admin-pw-input').value = '';
        }
      }

      function openAdminPanel() {
        renderAdmProducts(); renderAdmBanners(); loadConfigForm();
        document.getElementById('adm-overlay').classList.add('open');
      }

      function admTab(name, btn) {
        document.querySelectorAll('.adm-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.adm-form-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('adm-' + name).classList.add('active');
      }

      function previewImg(inputId, previewId, areaId) {
        const file = document.getElementById(inputId).files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          const prev = document.getElementById(previewId);
          prev.src = e.target.result; prev.style.display = 'block';
          const area = document.getElementById(areaId);
          if (area.querySelector('span')) area.querySelector('span').style.display = 'none';
          if (area.querySelector('p'))    area.querySelector('p').style.display    = 'none';
        };
        reader.readAsDataURL(file);
      }

      function previewEditImg(id) {
        const file = document.getElementById('ef-img-file-' + id).files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          const prev = document.getElementById('ef-img-prev-' + id);
          prev.src = e.target.result; prev.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }

      async function saveProduct() {
        const name = document.getElementById('p-name').value.trim();
        const descr = document.getElementById('p-desc').value.trim();
        const price = parseFloat(document.getElementById('p-price').value);
        const cat   = document.getElementById('p-cat').value;
        const tag   = document.getElementById('p-tag').value || null;
        const feat  = document.getElementById('p-feat').value === '1';
        const prev  = document.getElementById('p-img-preview');
        const img   = prev.style.display !== 'none' && prev.src?.startsWith('data:') ? prev.src : null;
        if (!name || !descr || isNaN(price)) { toast('? Preencha nome, descrição e preço!'); return; }
        const btn = document.getElementById('save-prod-btn');
        btn.disabled = true; btn.textContent = 'Salvando...';
        const { error } = await sb.from('pb_products').insert({ name, descr, price, cat, tag, feat, img });
        btn.disabled = false; btn.textContent = '?? Salvar Produto';
        if (error) { toast('? Erro: ' + error.message); return; }
        ['p-name','p-desc','p-price'].forEach(id => document.getElementById(id).value = '');
        prev.style.display = 'none';
        await reloadProducts(); renderAdmProducts(); renderProducts(curCat);
        toast('? Produto salvo!');
      }

      async function deleteProduct(id) {
        if (!confirm('Excluir este produto?')) return;
        const { error } = await sb.from('pb_products').delete().eq('id', id);
        if (error) { toast('? Erro: ' + error.message); return; }
        await reloadProducts(); renderAdmProducts(); renderProducts(curCat);
        toast('?? Produto excluído.');
      }

      let currentEditId = null;

      function openEditForm(id) {
        closeAllEditForms();
        const p = PRODUCTS.find(x => x.id === id);
        if (!p) return;
        currentEditId = id;
        const container = document.getElementById('edit-form-' + id);
        if (!container) return;
        container.innerHTML = `<div class="prod-edit-form">
          <label class="f-label">Nome</label><input type="text" class="f-input" id="ef-name-${id}" value="${esc(p.name)}">
          <label class="f-label">Descrição</label><textarea class="f-input" id="ef-desc-${id}">${esc(p.descr)}</textarea>
          <div class="edit-form-row">
            <div><label class="f-label">Preço (R$)</label><input type="number" class="f-input" id="ef-price-${id}" value="${p.price}" step="0.01"></div>
            <div><label class="f-label">Categoria</label>
              <select class="f-select" id="ef-cat-${id}">
                <option value="burger" ${p.cat==='burger'?'selected':''}>?? Burger</option>
                <option value="combo"  ${p.cat==='combo' ?'selected':''}>?? Combo</option>
                <option value="bebida" ${p.cat==='bebida'?'selected':''}>?? Bebida</option>
                <option value="sobremesa" ${p.cat==='sobremesa'?'selected':''}>?? Sobremesa</option>
                <option value="extra"  ${p.cat==='extra' ?'selected':''}>? Extra</option>
              </select>
            </div>
          </div>
          <div class="edit-form-row">
            <div><label class="f-label">Tag</label>
              <select class="f-select" id="ef-tag-${id}">
                <option value=""     ${!p.tag           ?'selected':''}>Nenhuma</option>
                <option value="hit"  ${p.tag==='hit'    ?'selected':''}>?? Hit</option>
                <option value="novo" ${p.tag==='novo'   ?'selected':''}>? Novo</option>
                <option value="smash"${p.tag==='smash'  ?'selected':''}>Smash</option>
              </select>
            </div>
            <div><label class="f-label">Em Destaque?</label>
              <select class="f-select" id="ef-feat-${id}">
                <option value="0" ${!p.feat?'selected':''}>Não</option>
                <option value="1" ${p.feat?'selected':''}>Sim</option>
              </select>
            </div>
          </div>
          ${p.img?`<img src="${p.img}" class="edit-img-preview" id="ef-img-prev-${id}" style="display:block">`:
                  `<img class="edit-img-preview" id="ef-img-prev-${id}">`}
          <div class="img-upload-area" style="margin-bottom:12px;" id="ef-upload-area-${id}">
            <input type="file" accept="image/*" id="ef-img-file-${id}" onchange="previewEditImg(${id})">
            <span>??</span><p>Clique para trocar</p>
          </div>
          <div class="edit-actions">
            <button class="edit-save-btn" id="ef-save-${id}" onclick="saveEditProduct(${id})">?? Salvar</button>
            <button class="edit-cancel-btn" onclick="closeAllEditForms()">Cancelar</button>
          </div>
        </div>`;
        container.style.display = 'block';
      }

      async function saveEditProduct(id) {
        const name  = document.getElementById('ef-name-' + id).value.trim();
        const descr = document.getElementById('ef-desc-' + id).value.trim();
        const price = parseFloat(document.getElementById('ef-price-' + id).value);
        const cat   = document.getElementById('ef-cat-' + id).value;
        const tag   = document.getElementById('ef-tag-' + id).value || null;
        const feat  = document.getElementById('ef-feat-' + id).value === '1';
        if (!name || !descr || isNaN(price)) { toast('? Preencha todos os campos!'); return; }
        const prevEl = document.getElementById('ef-img-prev-' + id);
        const orig   = PRODUCTS.find(x => x.id === id);
        let img = orig ? orig.img : null;
        if (prevEl?.src?.startsWith('data:')) img = prevEl.src;
        const btn = document.getElementById('ef-save-' + id);
        btn.disabled = true; btn.textContent = 'Salvando...';
        const { error } = await sb.from('pb_products').update({ name, descr, price, cat, tag, feat, img }).eq('id', id);
        btn.disabled = false; btn.textContent = '?? Salvar';
        if (error) { toast('? Erro: ' + error.message); return; }
        closeAllEditForms();
        await reloadProducts(); renderAdmProducts(); renderProducts(curCat);
        toast('? Produto atualizado!');
      }

      function closeAllEditForms() {
        currentEditId = null;
        document.querySelectorAll('[id^="edit-form-"]').forEach(el => { el.innerHTML = ''; el.style.display = 'none'; });
      }

      function renderAdmProducts() {
        const el = document.getElementById('prod-list-adm');
        if (!PRODUCTS.length) { el.innerHTML = '<div style="color:var(--gray);font-size:13px;text-align:center;padding:20px;">Nenhum produto cadastrado.</div>'; return; }
        el.innerHTML = PRODUCTS.map(p => `
          <div>
            <div class="prod-adm-item">
              <div class="prod-adm-img">${p.img?`<img src="${p.img}" alt="${esc(p.name)}">`:'??'}</div>
              <div class="prod-adm-info">
                <div class="prod-adm-name">${esc(p.name)}</div>
                <div class="prod-adm-price">R$${fmtPrice(p.price)} × ${p.cat}${p.tag?' × '+p.tag:''}</div>
              </div>
              <div class="prod-adm-actions">
                <button class="prod-edit-btn" onclick="openEditForm(${p.id})">??</button>
                <button class="prod-del-btn"  onclick="deleteProduct(${p.id})">??</button>
              </div>
            </div>
            <div id="edit-form-${p.id}" style="display:none;"></div>
          </div>`).join('');
      }

      async function saveBanner() {
        const title      = document.getElementById('b-title').value.trim();
        const sub        = document.getElementById('b-sub').value.trim();
        const badge      = document.getElementById('b-badge').value.trim();
        const badge_type = document.getElementById('b-badge-type').value;
        const prev = document.getElementById('b-img-preview');
        const img  = prev.style.display !== 'none' && prev.src?.startsWith('data:') ? prev.src : null;
        if (!title) { toast('? TTtulo obrigatrio!'); return; }
        const btn = document.getElementById('save-banner-btn');
        btn.disabled = true; btn.textContent = 'Salvando...';
        const { error } = await sb.from('pb_banners').insert({ title, title_highlight: '', sub, badge, badge_type, img });
        btn.disabled = false; btn.textContent = '?? Adicionar Banner';
        if (error) { toast('? Erro: ' + error.message); return; }
        ['b-title','b-sub','b-badge'].forEach(id => document.getElementById(id).value = '');
        prev.style.display = 'none';
        await reloadBanners(); renderCarousel(); renderAdmBanners();
        toast('? Banner adicionado!');
      }

      async function deleteBanner(id) {
        if (!confirm('Excluir este banner?')) return;
        const { error } = await sb.from('pb_banners').delete().eq('id', id);
        if (error) { toast('? Erro: ' + error.message); return; }
        await reloadBanners(); renderCarousel(); renderAdmBanners();
        toast('?? Banner excluído.');
      }

      function renderAdmBanners() {
        const el = document.getElementById('banner-adm-list');
        el.innerHTML = BANNERS.map(b => `
          <div class="banner-adm-item">
            <div class="banner-adm-color" style="background:${b.badge_type==='green'?'#4caf7d':b.badge_type==='red'?'#ff5252':'#f5a623'};"></div>
            <div class="banner-adm-info">
              <div class="banner-adm-title">${esc(b.title)}</div>
              <div class="banner-adm-sub">${esc(b.sub||'Sem subtítulo')}</div>
            </div>
            <button class="prod-del-btn" onclick="deleteBanner(${b.id})">??</button>
          </div>`).join('');
      }

      function loadConfigForm() {
        document.getElementById('cfg-wa').value      = CONFIG.wa      || '';
        document.getElementById('cfg-addr').value    = CONFIG.addr    || '';
        document.getElementById('cfg-fee-km').value  = CONFIG.fee_per_km || DELIVERY_FEE_PER_KM;
        document.getElementById('cfg-pw').value      = '';
      }

      async function saveConfig() {
        const wa         = document.getElementById('cfg-wa').value.trim()     || CONFIG.wa;
        const addr       = document.getElementById('cfg-addr').value.trim()   || CONFIG.addr;
        const fee_per_km = parseFloat(document.getElementById('cfg-fee-km').value) || DELIVERY_FEE_PER_KM;
        const pw         = document.getElementById('cfg-pw').value            || CONFIG.pw;
        const btn = document.getElementById('save-cfg-btn');
        btn.disabled = true; btn.textContent = 'Salvando...';
        const { error } = await sb.from('pb_config').upsert({ id: 1, wa, addr, pw, fee_per_km });
        btn.disabled = false; btn.textContent = '?? Salvar Configurações';
        if (error) { toast('? Erro: ' + error.message); return; }
        CONFIG = { id: 1, wa, addr, pw, fee_per_km };
        DELIVERY_FEE_PER_KM = fee_per_km; // Atualiza a taxa em memória
        STORE_ADDRESS = addr || STORE_ADDRESS;
        geocodeCache.clear();
        document.getElementById('loc-address').textContent = STORE_ADDRESS || 'Goiânia, Goiás - Brasil';
        updateOrderSummary();
        toast('? Configurações salvas!');
      }

      /* ---------------------------------------------------------------
         UTILIDADES
      --------------------------------------------------------------- */
      function fmtPrice(v) { return Number(v).toFixed(2).replace('.', ','); }
      function tagLabel(t) { return t === 'hit' ? '?? Hit' : t === 'novo' ? '? Novo' : 'Smash'; }
      function esc(s) {
        return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }

      function statusLabel(s) {
        const map = {
          pending:    '? Aguardando pagamento',
          paid:       '? Pago',
          preparing:  '????? Em preparo',
          on_the_way: '??? A caminho',
          delivered:  '?? Entregue',
          cancelled:  '? Cancelado',
        };
        return map[s] || s || '-';
      }

      function paymentMethodLabel(m) {
        const map = { mercadopago: 'Mercado Pago', pix: 'PIX', credit: 'Cartão', pending: 'Pendente' };
        return map[m] || m || '-';
      }

      function fmtDate(d) {
        if (!d) return '-';
        return new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
      }

      function normalizeOrderNumber(v) {
        const n = String(v||'').trim().toUpperCase();
        if (!n) return '';
        return n.startsWith('#') ? n : '#' + n;
      }

      function maskPhone(el) {
        let v = (el.value||'').replace(/\D/g,'');
        if (v.length <= 10) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
        else v = v.replace(/(\d{2})(\d{1})(\d{4})(\d{0,4})/,'($1) $2 $3-$4');
        el.value = v.substring(0, 16);
      }

      function parseOrderItems(items) {
        try {
          if (Array.isArray(items)) return items;
          if (typeof items === 'string') return JSON.parse(items);
        } catch(_) {}
        return [];
      }

      function toast(msg, dur = 2800) {
        const el = document.getElementById('toast');
        el.textContent = msg; el.style.display = 'block';
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.style.display = 'none'; }, dur);
      }

      /* --- SCROLL COM F�SICA --- */
      function initPhysicsScroll(el) {
        let isDragging=false, startX=0, scrollLeft=0, velX=0, lastX=0, lastTime=0, rafId=null, didDrag=false;
        function momentum() {
          if (Math.abs(velX) < 0.3) { velX = 0; return; }
          velX *= 0.92; el.scrollLeft += velX;
          const max = el.scrollWidth - el.clientWidth;
          if (el.scrollLeft < 0) { el.scrollLeft = 0; velX *= -0.4; }
          if (el.scrollLeft > max) { el.scrollLeft = max; velX *= -0.4; }
          rafId = requestAnimationFrame(momentum);
        }
        el.addEventListener('mousedown', e => {
          isDragging=true; didDrag=false; startX=e.pageX-el.offsetLeft; scrollLeft=el.scrollLeft;
          lastX=e.pageX; lastTime=Date.now(); velX=0; cancelAnimationFrame(rafId); el.classList.add('grabbing');
        });
        el.addEventListener('mousemove', e => {
          if (!isDragging) return; e.preventDefault();
          const x=e.pageX-el.offsetLeft, walk=(x-startX)*1.2;
          el.scrollLeft = scrollLeft-walk;
          const now=Date.now(), dt=now-lastTime||1;
          velX=(e.pageX-lastX)/dt*14; lastX=e.pageX; lastTime=now;
          if (Math.abs(walk)>4) didDrag=true;
        });
        const end = () => { if (!isDragging) return; isDragging=false; el.classList.remove('grabbing'); if (Math.abs(velX)>1) rafId=requestAnimationFrame(momentum); };
        el.addEventListener('mouseup', end);
        el.addEventListener('mouseleave', end);
        el.addEventListener('touchstart', e => { didDrag=false; startX=e.touches[0].pageX-el.offsetLeft; scrollLeft=el.scrollLeft; lastX=e.touches[0].pageX; lastTime=Date.now(); velX=0; cancelAnimationFrame(rafId); }, {passive:true});
        el.addEventListener('touchmove', e => { const x=e.touches[0].pageX-el.offsetLeft, walk=(x-startX)*1.1; el.scrollLeft=scrollLeft-walk; const now=Date.now(), dt=now-lastTime||1; velX=(e.touches[0].pageX-lastX)/dt*14; lastX=e.touches[0].pageX; lastTime=now; if (Math.abs(walk)>4) didDrag=true; }, {passive:true});
        el.addEventListener('touchend', () => { if (Math.abs(velX)>1) rafId=requestAnimationFrame(momentum); });
        el.addEventListener('click', e => { if (didDrag) { e.stopPropagation(); e.preventDefault(); didDrag=false; } }, true);
      }

      /* ---------------------------------------------------------------
         INICIALIZA��O
      --------------------------------------------------------------- */
      (async function init() {
        const ok = await initDB();
        const params = new URLSearchParams(window.location.search);

        STORE_ADDRESS = CONFIG.addr || STORE_ADDRESS;
        document.getElementById('loc-address').textContent = STORE_ADDRESS || 'Goiânia, Goiás - Brasil';
        renderCarousel();
        renderProducts();
        updateOrderSummary();

        const ls = document.getElementById('loading-screen');
        ls.classList.add('fade');
        setTimeout(() => ls.style.display = 'none', 500);

        if (!ok) toast('?? Banco offline - exibindo dados padrão');
        if (params.get('admin') === '1') setTimeout(openAdminGate, 250);

        // Exp�e fun��o de admin globalmente para o bot�o Central
        window.openAdminGate = openAdminGate;
      })();
    