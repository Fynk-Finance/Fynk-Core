#!/bin/sh
# Creates the local CA and the certificates of the local stack. make certs runs it inside the
# pinned smallstep/step-cli image, so nothing is installed on the host. Output: certs/ (gitignored).
#
#   ca.crt / ca.key                    "Fynk Local CA", 1 year; ca.key never enters a container
#   caddy.crt / caddy.key              Caddy egress server certificate (caddy, localhost)
#   bank-simulator.crt / .key          Banco Demo internal mTLS listener
#   fynk-client.crt / .key             client certificate Caddy presents to the bank
#
# Leaf certificates last 90 days, like the rotation rule of M14. Existing files are kept;
# FORCE=1 recreates everything. These keys are for this machine only and are never used elsewhere.
set -eu
cd /certs

if [ -n "${FORCE:-}" ] || [ ! -f ca.crt ]; then
  step certificate create "Fynk Local CA" ca.crt ca.key \
    --profile root-ca --not-after 8760h --no-password --insecure --force
  FORCE=1 # a new CA invalidates every leaf certificate
fi

leaf() {
  name=$1
  shift
  if [ -z "${FORCE:-}" ] && [ -f "$name.crt" ]; then
    echo "keep $name.crt"
    return
  fi
  step certificate create "$name" "$name.crt" "$name.key" \
    --profile leaf --ca ca.crt --ca-key ca.key \
    --not-after 2160h --no-password --insecure --force "$@"
}

leaf caddy --san caddy --san localhost --san 127.0.0.1
leaf bank-simulator --san bank-simulator
leaf fynk-client --san fynk-client

# The containers run as other users (distroless nonroot), so they must be able to read the keys.
chmod 644 ./*.crt caddy.key bank-simulator.key fynk-client.key
chmod 600 ca.key
echo "certificates ready in certs/"
