#!/bin/bash

# Port Lookup API - Guía de instalación rápida

echo "🚀 Port Lookup API - Setup"
echo "=========================="

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Descárgalo en https://nodejs.org"
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"

# Instalar dependencias
echo ""
echo "📦 Instalando dependencias..."
npm install

# Crear .env si no existe
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creando archivo .env..."
    cp .env.example .env
    echo "✅ Archivo .env creado (modo demo habilitado)"
fi

echo ""
echo "🎉 Setup completado!"
echo ""
echo "Para iniciar el servidor, ejecuta:"
echo "  npm start"
echo ""
echo "Luego abre en tu navegador:"
echo "  http://localhost:3000"
echo ""
