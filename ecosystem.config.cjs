module.exports = {
  apps: [{
    name: 'moningu',
    script: 'node',
    args: 'index.js',
    cwd: '/root/moningu-real/artifacts/discord-bot',
    autorestart: true,
    restart_delay: 5000,
    max_restarts: 50,
    watch: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
