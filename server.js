const express = require('express');
const path = require('path');
const fs = require('fs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Base de datos en memoria para MVP (se reemplaza con DB real)
const apiKeys = new Map();
const users = new Map();
const portDatabase = require('./data/ports.json');

// Planes
const PLANS = {
  starter: { name: 'Starter', price: 9900, queries: 1000, stripeId: 'price_starter_mxn' },
  pro: { name: 'Professional', price: 29900, queries: 50000, stripeId: 'price_pro_mxn' },
  business: { name: 'Business', price: 59900, queries: 500000, stripeId: 'price_business_mxn' }
};

// ============ API ENDPOINTS ============

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Planes disponibles
app.get('/api/v1/plans', (req, res) => {
  const plans = Object.entries(PLANS).map(([key, plan]) => ({
    id: key,
    name: plan.name,
    price: plan.price,
    currency: 'MXN',
    queries_per_month: plan.queries,
    features: getFeaturesByPlan(key)
  }));
  res.json({ success: true, plans });
});

// Lookup de puertos (MAIN API)
app.get('/api/v1/lookup', (req, res) => {
  const { port, protocol, api_key } = req.query;

  // Validación
  if (!port || !protocol) {
    return res.status(400).json({
      success: false,
      error: 'Parámetros requeridos: port y protocol (tcp/udp)'
    });
  }

  if (!api_key) {
    return res.status(401).json({
      success: false,
      error: 'API key requerida. Registrate en portlookup.example para obtenerla.'
    });
  }

  // Validar API key
  if (!apiKeys.has(api_key)) {
    return res.status(403).json({
      success: false,
      error: 'API key inválida o expirada'
    });
  }

  const portNum = parseInt(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return res.status(400).json({
      success: false,
      error: 'Puerto inválido. Rango: 1-65535'
    });
  }

  const protocolLower = protocol.toLowerCase();
  if (!['tcp', 'udp'].includes(protocolLower)) {
    return res.status(400).json({
      success: false,
      error: 'Protocolo inválido. Usa: tcp o udp'
    });
  }

  // Buscar en la base de datos
  const key = `${portNum}/${protocolLower}`;
  const portInfo = portDatabase[key];

  if (!portInfo) {
    return res.json({
      success: true,
      port: portNum,
      protocol: protocolLower,
      service: 'unknown',
      description: 'Puerto sin servicio registrado'
    });
  }

  // Log de uso
  logUsage(api_key);

  res.json({
    success: true,
    port: portNum,
    protocol: protocolLower,
    service: portInfo.service,
    description: portInfo.description,
    common_uses: portInfo.uses || []
  });
});

// Crear checkout de Stripe
app.post('/api/v1/create-checkout', express.json(), async (req, res) => {
  try {
    const { plan, email } = req.body;

    if (!plan || !email || !PLANS[plan]) {
      return res.status(400).json({
        success: false,
        error: 'Plan y email requeridos. Planes válidos: starter, pro, business'
      });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('dummy')) {
      return res.status(500).json({
        success: false,
        error: 'Stripe no está configurado. Contacta al soporte.',
        demo_mode: true
      });
    }

    const planData = PLANS[plan];

    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: planData.stripeId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/#planes`,
      customer_email: email
    });

    res.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    });
  } catch (error) {
    console.error('Stripe error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Webhook de Stripe (para activar planes automáticamente)
app.post('/api/v1/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || webhookSecret.includes('dummy')) {
    return res.status(400).json({ received: false });
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.customer_email;
      const plan = identifyPlanFromSession(session);

      // Generar API key para el usuario
      const apiKey = generateApiKey();
      apiKeys.set(apiKey, {
        email,
        plan,
        created_at: new Date(),
        stripe_session: session.id
      });

      users.set(email, {
        api_key: apiKey,
        plan,
        status: 'active',
        created_at: new Date()
      });

      console.log(`✅ Usuario activado: ${email} - Plan: ${plan} - API Key: ${apiKey}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Dashboard (para que clientes vean su uso)
app.get('/dashboard.html', (req, res) => {
  const filePath = path.join(__dirname, 'dashboard.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Dashboard no disponible');
  }
});

// Página de éxito después de pago
app.get('/success.html', (req, res) => {
  const filePath = path.join(__dirname, 'success.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Página no encontrada');
  }
});

// Raíz - sirve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============ FUNCIONES AUXILIARES ============

function getFeaturesByPlan(plan) {
  const features = {
    starter: [
      '1,000 consultas/mes',
      'Puertos TCP/UDP básicos',
      'Soporte por email',
      'API REST'
    ],
    pro: [
      '50,000 consultas/mes',
      'Todos los puertos registrados',
      'Acceso prioritario',
      'Documentación avanzada',
      'Soporte rápido'
    ],
    business: [
      'Volumen personalizado',
      'SLAs garantizados',
      'Soporte dedicado',
      'Integraciones a medida',
      'Analytics avanzados'
    ]
  };
  return features[plan] || [];
}

function generateApiKey() {
  return 'pk_' + Math.random().toString(36).substr(2, 32).toUpperCase();
}

function logUsage(apiKey) {
  // Aquí se registraría el uso en una BD real
  if (apiKeys.has(apiKey)) {
    const keyData = apiKeys.get(apiKey);
    keyData.last_used = new Date();
  }
}

function identifyPlanFromSession(session) {
  // Implementación simple - en producción, buscar en session.line_items
  return 'pro'; // Default
}

// ============ START SERVER ============

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Port Lookup API Running`);
  console.log(`📍 http://0.0.0.0:${PORT}`);
  console.log(`📚 API Docs: GET /api/v1/health`);
  console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ Configurado' : '⚠️  Modo Demo'}\n`);
});
