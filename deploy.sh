#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
node --check web/app.js
test -s fallback/web/boxedwine.wasm
test -s fallback/web/boxedwine.zip
test -s fallback/web/asche.zip
install -d /var/www/asche/emulator
cp -a web/. /var/www/asche/
cp -a fallback/web/. /var/www/asche/emulator/
install -m 0644 deploy/asche.rammwiki.mrzetti.com /etc/nginx/sites-available/asche.rammwiki.mrzetti.com
nginx -t
systemctl reload nginx
curl --fail --silent --show-error -I https://asche.rammwiki.mrzetti.com/
