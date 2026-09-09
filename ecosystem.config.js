module.exports = {
  apps: [
    {
      name: 'marioguerra',
      cwd: '/home/fenix/marioguerra',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3320',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production', TZ: 'UTC' },
    },
  ],
};
