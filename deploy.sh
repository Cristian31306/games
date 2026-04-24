#!/bin/bash

# Abortar si hay errores
set -e

echo "🚀 Iniciando despliegue de Canal Games Hub..."

# 0. Limpiar y Actualizar desde Git
echo "📥 Bajando últimas actualizaciones de GitHub..."
git fetch --all
git reset --hard origin/main

# 1. Instalar dependencias del proyecto raíz
echo "📦 Instalar dependencias raíz..."
npm install

# 2. Asegurar permisos de ejecución en binarios (Para evitar 'vite: Permission denied')
echo "🔑 Asegurando permisos de ejecución en binarios..."
chmod -R +x node_modules/.bin/ || true

# 3. Construyendo sub-proyectos (Stop, etc.)...
echo "🏗️ Construyendo sub-proyectos (Stop, etc.)..."
npm run build

# 4. Reiniciar el servidor con PM2
echo "🔄 Reiniciando proceso en PM2..."
if pm2 list | grep -q "algorah-games-hub"; then
    pm2 restart ecosystem.config.cjs
else
    pm2 start ecosystem.config.cjs
fi

echo "✅ ¡Despliegue completado con éxito!"
