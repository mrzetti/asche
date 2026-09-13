# Host Asche zu Asche on the RammWiki VPS

This is a static website: Windows/Wine/Boxedwine run in the visitor's browser,
not on the VPS. The repository includes the pinned runtime, original game files,
audio fix and quiet background song. No game build or backend service is needed.

Use a dedicated HTTPS hostname, e.g. `asche.rammwiki.net`, pointed at the VPS.
Ensure any AAAA record is correct and ports 80/443 reach nginx.

## First installation (Debian/Ubuntu)

As root, from the cloned repository:

```sh
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx
HOST=asche.rammwiki.net
install -d /var/www/asche/emulator
cp -a web/. /var/www/asche/
cp -a fallback/web/. /var/www/asche/emulator/
sed "s/ASCHE_HOST/$HOST/g" deploy/nginx-vps.conf > /etc/nginx/sites-available/asche
ln -s /etc/nginx/sites-available/asche /etc/nginx/sites-enabled/asche
nginx -t
systemctl reload nginx
certbot --nginx -d "$HOST" --redirect
curl --fail -I "https://$HOST/"
```

Keep nginx's standard MIME types enabled: `.wasm` should be application/wasm.
Keep the supplied COOP/COEP/CORP headers. HTTPS plus cross-origin isolation is
required for SharedArrayBuffer and the threaded runtime. All runtime assets are
self-hosted; the first emulator download is roughly 40 MB, plus the song.
Check certificate renewal with `certbot renew --dry-run`.

## Updating

```sh
git pull --ff-only
cp -a web/. /var/www/asche/
cp -a fallback/web/. /var/www/asche/emulator/
```

The top-level deploy.sh is for the original mrzetti.com server, not this new VPS.
Keep the new VPS's nginx/TLS configuration. Serve at the hostname root; the
wrapper uses `/emulator/` and `/audio/` URLs.

## Verify

Open the HTTPS site in a desktop browser, click Load game, wait for the title,
and click it. Hold arrow keys to move/jump and Space to fire. Check effects,
quiet background song, Disable music, volume, fullscreen and restart. A browser
console check of `crossOriginIsolated` should return true. If a runtime error
occurs, Download crash report preserves the first failure for investigation.

The original game and emulator have not been verified through all three levels.
A reported late-stage-one helicopter crash remains unresolved; see
fallback/web/AUDIO-FIX.md. Automated tools under tools/ contain original-server
URLs and local Playwright paths; adapt those before running elsewhere.

## Wiki embedding

Standalone hosting works with this configuration. An iframe inside MediaWiki
also requires cross-origin isolation of the top-level wiki page and compatible
iframe permission/resource policies; this template alone does not configure
MediaWiki. Asche currently has the full-page wrapper, not a compact embed mode.

## Preservation and licenses

Game provenance: assets/SOURCES.md. Boxedwine runtime provenance, pinned audio
patch and licenses: fallback/web/PROVENANCE.md, AUDIO-FIX.md and licenses/.
The song is an added website soundtrack (web/audio/README.md); original game
assets and music retain their owners' rights. The historical wine-assembly
prototype under runtime/ is retained for research and is not served by the page.
