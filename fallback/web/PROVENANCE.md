# Provenance — `fallback/web`

**Audio update (2026-09-13):** see [AUDIO-FIX.md](AUDIO-FIX.md) for the SDL
main-thread proxy fix and volume support. Runtime hashes below record the
package before those local edits; `boxedwine.js` and `boxedwine.html` are now
modified, and `audio.js` is new.

Every file in this directory is either (a) taken byte-for-byte from an upstream
open-source release, (b) built from the original game files in
`assets/original/`, or (c) a local, documented runtime/wrapper edit.
No proprietary Windows OS image is used or required.

## 1. Emulator runtime + Wine filesystem

| Item | Source |
| --- | --- |
| Boxedwine web build | `Boxedwine26R1Web.zip` (122,244,710 bytes), GitHub release **26R1.0** of <https://github.com/danoon2/Boxedwine> |
| Release page | <https://github.com/danoon2/Boxedwine/releases/tag/26R1.0> |
| Download URL used | <https://github.com/danoon2/Boxedwine/releases/download/26R1.0/Boxedwine26R1Web.zip> |
| Files taken | `MultiThreaded/boxedwine.js`, `MultiThreaded/boxedwine.wasm`, `MultiThreaded/boxedwine-shell.js`, `MultiThreaded/boxedwine.css`, `MultiThreaded/boxedwine.html`, `MultiThreaded/boxedwine.zip` |
| Boxedwine licence | GNU GPL-2.0 — `licenses/LICENSE-Boxedwine-GPL-2.0.txt` |

The release zip contains two builds (`MultiThreaded/` and `SingleThreaded/`)
plus an alternative `Wine11/boxedwine.zip`. **This fallback uses the
`MultiThreaded` build and its `boxedwine.zip` only.** The alternative Wine 11
filesystem was tested and does **not** load with this emulator build
(`import_dll Library krnl386.exe16 ... not found`), so it is deliberately not
included.

### Wine filesystem version

`boxedwine.zip` is the stripped Wine filesystem shipped in the release. Its own
`wineVersion.txt` reports `6.0`, and the release readme describes it as "a super
stripped down version of the Wine 6.0 file system". It is the exact file the
verified run served as `?root=boxedwine` (filename `boxedwine.zip`).

### Third-party components inside `boxedwine.zip`

`boxedwine.zip` is an unmodified copy of the upstream release file. It bundles
open-source components of the Boxedwine/Wine filesystem, including:

- Wine 6.0 (`opt/wine/**`) — GNU LGPL-2.1-or-later;
  `licenses/LICENSE-Wine-LGPL-2.1.txt`, `licenses/COPYING.LIB-Wine-LGPL-2.1.txt`.
- BusyBox (`bin/busybox`) — GNU GPL-2.0.
- GNU glibc and related libraries (`lib/**`) — GNU LGPL/ GPL.

See the Boxedwine repository for the complete component list and the release's
`readme.txt`. The GPL-2.0 text in `licenses/` covers Boxedwine and applies to
redistribution of this combined filesystem.

## 2. Game application files — `asche.zip`

`asche.zip` is built from the original, unmodified game files in
`assets/original/` (which are the 1997 promotional CD-Extra files):

| Member | Origin |
| --- | --- |
| `RSTEIN.EXE` | `assets/original/RSTEIN.EXE` (Win16 NE executable) |
| `VBRUN300.DLL` | `assets/original/VBRUN300.DLL` (Microsoft Visual Basic 3.0 runtime) |
| `RAMM16.DLL` | `assets/original/RAMM16.DLL` (game engine DLL) |
| `WAV/*.WAV` | `assets/original/WAV/*.WAV` (15 sound effects) |

The files are stored in the archive with `zip -X` (no extra attributes) so
`asche.zip` is reproducible from `assets/original/`:

```bash
rm -rf appstage && mkdir -p appstage/WAV
cp assets/original/RSTEIN.EXE assets/original/VBRUN300.DLL assets/original/RAMM16.DLL appstage/
cp assets/original/WAV/*.WAV appstage/WAV/
(cd appstage && zip -q -r -X ../asche.zip .)
```

`VBRUN300.DLL` is Microsoft's redistributable Visual Basic 3.0 runtime as
shipped on the original CD-Extra; it is redistributed here only as the
unmodified file that came with the game.

## 3. Local edit to `boxedwine-shell.js`

`boxedwine-shell.js` is the upstream `MultiThreaded/boxedwine-shell.js` plus one
backwards-compatible addition: an optional `args` query parameter that appends
raw emulator arguments to the Wine command line. With no `args` parameter the
behaviour is byte-for-byte identical to upstream. The verified run does not use
it; it was added only to make Wine debug options testable during bring-up.

```diff
@@ Config.d_drive = "/d_drive";
+			Config.extraArgs = getExtraArgs();
+        }
+        function getExtraArgs() {
+            var raw = getParameter("args").trim();
+            var out = [];
+            if(!allowParameterOverride() || raw.length === 0) {
+                return out;
+            }
+            raw.split(';').forEach(function(item){
+                item = item.trim();
+                if(item.length > 0) out.push(decodeURIComponent(item));
+            });
+            console.log("extra emulator args: " + out);
+            return out;
         }
@@ before params.push("/bin/wine");
+        	if (Config.extraArgs && Config.extraArgs.length > 0) {
+        	    for (var ai = 0; ai < Config.extraArgs.length; ai++) {
+        	        params.push(Config.extraArgs[ai]);
+        	    }
+        	}
         	params.push("/bin/wine");
```

Everything else (`boxedwine.js`, `boxedwine.wasm`, `boxedwine.css`,
`boxedwine.html`, `boxedwine.zip`) is unmodified upstream.

## 4. SHA-256 of the packaged files

```
50f291c7bc0dbbc25de5ae4b162a430aa5b8fe496c644fb4353c579cc25bfce6  boxedwine.html
96c64b7abed1f731a0d326c080905934b42ab061ee2cdf69658f7d8d9a4812ef  boxedwine.js
4e03e82c2068b02d1ed4280c3bc2650dbeb374ef4a78263c0b370621afb9521b  boxedwine.wasm
276154a6483e69244180e802c60d6b1bb15cbfa6bf01f1dfe17517807db4c89a  boxedwine-shell.js
8b3eb7d7023d7eba9294d3c333b420a0c752d9e229feeb5ea2dc37393d8a16e9  boxedwine.css
55b26c04b46986c977d6ec18989623d983274e03a72d3dc2fb048fc74d1245f9  boxedwine.zip
f680279100f5976dd1302e3e684e1f57696301d5fce1eafc8c07866edb377158  asche.zip
90907794583840de8c51bb3ee3b3a60371a2f395c21b03b19ac823f7118655be  server.mjs
```

## 5. Reproduce from scratch

```bash
curl -sL -o Boxedwine26R1Web.zip \
  https://github.com/danoon2/Boxedwine/releases/download/26R1.0/Boxedwine26R1Web.zip
unzip Boxedwine26R1Web.zip
# use MultiThreaded/{boxedwine.html,boxedwine.js,boxedwine.wasm,boxedwine-shell.js,boxedwine.css,boxedwine.zip}
# build asche.zip from assets/original/ with the command in section 2
```
