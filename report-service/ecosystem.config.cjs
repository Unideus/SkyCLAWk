'use strict';

module.exports = {
  apps: [
    {
      name: 'zodi-yuga-report-service',
      cwd: __dirname,
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 3000,
      max_memory_restart: '768M',
      kill_timeout: 30000,
      listen_timeout: 10000,
      time: true,
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
