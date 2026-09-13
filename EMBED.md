# Compact Asche embed

Use `https://YOUR-ASCHE-HOST/?embed=1` for the compact player. It includes a
click-to-load title panel, volume, music toggle, fullscreen, restart and a link
to the full page. Nothing downloads from the emulator until Load game is clicked.
The player fits the iframe height; a desktop keyboard is recommended.

```html
<iframe src="https://asche.rammwiki.net/?embed=1"
  title="Play Asche zu Asche" width="100%" height="680"
  style="border:0" loading="lazy"
  allow="autoplay; fullscreen; cross-origin-isolated" allowfullscreen>
</iframe>
```

MediaWiki needs a configured widget/extension to render the iframe.

## Required browser isolation

Boxedwine uses SharedArrayBuffer. The **top-level wiki page** must be served over
HTTPS with COOP `same-origin` and COEP `require-corp`, and compatible headers must
remain on the Asche wrapper and its emulator iframe. The outer iframe must
delegate `cross-origin-isolated` (as above); an explicit Permissions-Policy on
the wiki must also allow the game's origin. A subdomain alone does not enable
isolation. The wrapper checks isolation before starting the emulator and gives
a message/link when it is unavailable.

The default standalone nginx template uses CORP `same-origin`. For embedding
across subdomains on the same HTTPS site (e.g. rammwiki.net → asche.rammwiki.net),
adjust Asche's CORP header to `same-site`. For genuinely different sites, a
compatible `cross-origin` policy is needed instead. Test the actual wiki page:
COEP also affects the wiki's images, scripts and other embeds. The compact view
does not automatically change server policies.

The browser check verifies a same-origin, isolated parent with nested wrapper
and emulator, plus graceful handling of a non-isolated parent. It does not
validate a particular MediaWiki server's cross-origin policies:

```sh
npm install --no-save playwright
npx playwright install chromium
LIVE=1 ASCHE_URL=https://asche.rammwiki.net node tools/verify-embed.cjs
```

Optional `BROWSER_PATH` selects an installed Chromium; `PLAYWRIGHT_MODULE` selects
an existing Playwright module. Supply ASCHE_URL without a trailing slash.
