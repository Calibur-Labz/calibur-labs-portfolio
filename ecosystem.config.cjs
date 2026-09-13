/**
 * PM2 process for the self-hosted site on the Hetzner VPS.
 *
 * `cwd` is the `current` symlink that `deploy/deploy.sh` swaps on each
 * release, so a reload always starts the newest build. Secrets come from
 * `shared/.env` via Node's `--env-file`; nothing sensitive lives here.
 */
module.exports = {
  apps: [
    {
      name: "calibur-portfolio",
      cwd: "/var/www/calibur-portfolio/current",
      script: "server.js",
      node_args: "--env-file=/var/www/calibur-portfolio/shared/.env",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "600M",
      env: {
        PORT: "3001",
        // Loopback only — Nginx is the public entry point.
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
      },
    },
  ],
};
