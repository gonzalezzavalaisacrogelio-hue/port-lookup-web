# Port Lookup API - Documentación Rápida

## Inicio rápido

```bash
npm install
npm start
```

Abre: http://localhost:3000

## API Endpoints

### Health Check
```
GET /api/v1/health
Respuesta: { "status": "ok" }
```

### Listar Planes
```
GET /api/v1/plans
Respuesta: Lista de planes disponibles con precios
```

### Consultar Puerto (MAIN)
```
GET /api/v1/lookup?port=443&protocol=tcp&api_key=pk_xxx

Parámetros:
- port: número de puerto (1-65535)
- protocol: tcp o udp
- api_key: tu clave de API

Respuesta:
{
  "success": true,
  "port": 443,
  "protocol": "tcp",
  "service": "https",
  "description": "HTTP Secure"
}
```

### Crear Checkout (para pago)
```
POST /api/v1/create-checkout
Body: { "plan": "starter|pro|business", "email": "cliente@email.com" }

Respuesta:
{
  "success": true,
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_xxx"
}

En modo demo: devuelve demo_mode: true
```

## Modos de operación

### Modo Demo (Producción sin Stripe)
- Sin STRIPE_SECRET_KEY configurada
- Los checkouts simulan la activación
- Perfecto para testing local

### Modo Producción (Con Stripe)
- STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET configuradas
- Pagos reales en Stripe
- Webhooks activan API Keys automáticamente
- **Sin cambios en el código necesarios**

## Configuración

### .env (Modo Demo - Sin claves)
```
PORT=3000
NODE_ENV=development
```

### .env (Con Stripe - Producción)
```
PORT=3000
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
APP_BASE_URL=https://tudominio.com
```

## Dashboard del Cliente

Accede a: http://localhost:3000/dashboard.html

Muestra:
- Plan actual
- Consultas disponibles
- Uso de API
- Prueba de API en tiempo real

## Próximos pasos

1. ✅ Landing completada
2. ✅ API lista para consultas
3. ✅ Checkout preparado
4. ⏳ Conectar Stripe (sin cambios de código)
5. ⏳ Desplegar a Render/Heroku
6. ⏳ Dominio personalizado

## Soporte

Email: soporte@portlookup.io
