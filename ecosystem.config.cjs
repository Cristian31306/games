module.exports = {
  apps : [{
    name: 'algorah-games-hub',
    script: 'server.js',
    instances: 1, // Puedes subir a 'max' si el VPS tiene muchos núcleos
    autorestart: true,
    watch: false, // En producción mejor false
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 80 // O el puerto que use el VPS
    }
  }]
};
