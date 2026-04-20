#!/bin/bash

# Abortar si hay errores
set -e

echo "🚀 Iniciando despliegue de Canal Games Hub..."

# 1. Instalar dependencias del proyecto raíz
echo "📦 Instalar dependencias raíz..."
npm install

# 2. Instalar dependencias y construir sub-proyectos
echo "🏗️ Construyendo sub-proyectos (Stop, etc.)..."
npm run build

# 3. Reiniciar el servidor con PM2
echo "🔄 Reiniciando proceso en PM2..."
if pm2 list | grep -q "algorah-games-hub"; then
    pm2 restart ecosystem.config.cjs
else
    pm2 start ecosystem.config.cjs
fi

echo "✅ ¡Despliegue completado con éxito!"
