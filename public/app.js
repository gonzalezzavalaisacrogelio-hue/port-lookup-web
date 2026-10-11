// Manejo del checkout de Stripe
async function handleCheckout(plan) {
  const email = prompt('Ingresa tu email para continuar:');
  if (!email) return;

  try {
    const response = await fetch('/api/v1/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ plan, email })
    });

    const data = await response.json();

    if (data.success && data.checkout_url) {
      window.location.href = data.checkout_url;
    } else if (data.demo_mode) {
      alert('🔧 Modo Demo: Stripe aún no está configurado.\n\nEn producción, esto abriría el checkout de Stripe.');
      // Simular activación de plan para demo
      localStorage.setItem('demo_api_key', 'pk_demo_' + Math.random().toString(36).substr(2));
      localStorage.setItem('demo_plan', plan);
      window.location.href = '/success.html';
    } else {
      alert('Error: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error al procesar el pago: ' + error.message);
  }
}

// Probar la API directamente
async function testApiLive() {
  const port = prompt('Puerto a consultar (ej: 443):', '443');
  if (!port) return;

  const protocol = confirm('¿TCP? (OK=TCP, Cancelar=UDP)') ? 'tcp' : 'udp';

  try {
    const response = await fetch(`/api/v1/lookup?port=${port}&protocol=${protocol}`);
    const data = await response.json();

    if (data.success) {
      alert(`✓ Respuesta\n\nPuerto: ${data.port}\nServicio: ${data.service}\n${data.description}`);
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    alert('Error de conexión: ' + error.message);
  }
}
