#!/bin/sh
# Container entrypoint: migrate first, then serve.
#
# `set -e` matters here — if the migration exits non-zero the container must die
# rather than start an app against a schema it doesn't match. That failure is
# exactly what makes Coolify abort the deployment and keep the old container.
set -e

node scripts/migrate-with-lock.mjs

echo "[start] Server startet auf Port ${PORT:-3000}."
# exec: node becomes PID 1 and receives SIGTERM directly, so the container
# shuts down promptly instead of waiting out Docker's 10s kill timeout.
exec node server.js
