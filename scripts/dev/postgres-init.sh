#!/bin/sh
# Runs once, when the postgres container starts with an empty volume (docker-entrypoint-initdb.d).
# The fynk database is created by the image from POSTGRES_DB. This adds the keycloak database
# with its own role, so Keycloak never sees the Fynk schemas.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v kc_password="$KEYCLOAK_DB_PASSWORD" <<'SQL'
CREATE ROLE keycloak LOGIN PASSWORD :'kc_password';
CREATE DATABASE keycloak OWNER keycloak;
SQL
