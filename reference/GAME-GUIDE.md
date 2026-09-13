# Asche zu Asche (1997) — English game guide

Research notes for an English browser wrapper around the original Rammstein
Windows game. This document records the **objective**, **controls**, **level
structure** and **scoring** of the 1997 original, and separates material that is
verified from material that is only documented by fans or inferred from the
binary.

Everything here was derived from the preserved original files in
`assets/original/` (notably `RSTEIN.EXE`) and from the sources listed at the
bottom. No original file was modified.

> **Confidence legend**
> * **[V]** verified in the preserved originals or the original 1997 readme.
> * **[D]** documented by a credible, specific secondary source (archived fan
>   walkthrough / fan wiki).
> * **[?]** inferred or unconfirmed — treat as a guess until runtime testing
>   confirms it.

---

## 1. What the game is

* **Title:** *Rammstein Computerspiel für Windows* — commonly called the
  *Asche zu Asche* game. **[V]**
* **Year / author:** 1997, produced by **Oliver Czok** for **Motor Music**. **[V]**
  (`produced for Motor / a PolyGram company … produced by © 1997 Oliver Czok`
  appear on the extracted ending screen,
  `reference/extracted/highscore-outro.png`.)
* **Distribution:** shipped as a data track on retail copies of the
  *Das Modell* single (release date 24 November 1997). Promo copies omitted
  the game. **[D]**
* **Genre:** 2-D side-scrolling run-and-gun / platform shooter. **[V]**
* **Requirements (original readme):** Windows 95, 486 CPU, 8 MB RAM, 256
  colours. **[V]** (`assets/original/README.TXT`)
* **Runtime files:** `RSTEIN.EXE` (Win16 NE, Visual Basic 3), `RAMM16.DLL`
  (custom sprite/bitmap engine), `VBRUN300.DLL`, plus WAV audio. **[V]**

The wrapper only needs to reproduce the game; it must **not** recreate the
1997 high-score competition or its file submission (see §6).

---

## 2. Objective

The player character is the masked man from the *Du hast* video (white face
mask, red shirt, flame weapon). The game has **3 levels, each with 3 vertical
"platforms"**. **[D]**

To finish a level and ultimately the game, the player must:

1. Move through the level (the walkthrough repeatedly says to walk "forward"
   and turn around to backtrack). **[D]**
2. **Shoot the floating band-member faces** (from the *Sehnsucht* artwork) to
   "activate" them and open the way to the next platform / level. **[D]**
3. Survive the enemies and hazards and reach the end of level 3. **[D]**

The scoring rules from the original readme make the *real* objective explicit:
**collect as many points as possible, waste as few shots as possible, and
finish as fast as possible.** **[V]**

---

## 3. Controls

| Action | Key | Confidence | Evidence |
| --- | --- | --- | --- |
| Walk left | **←** (Left arrow) | **[D]** | Archived walkthrough: *"Walk - left and right arrow keys"*. Also consistent with the `GetKeyboardState`/`SetKeyboardState` imports and `imgManStepL`/`imgManStepLO` sprite names in `RSTEIN.EXE`. |
| Walk right | **→** (Right arrow) | **[D]** | same |
| Jump | **↑** (Up arrow) | **[D]** | *"Jump - up arrow key"*; `imgManJumpL`/`imgManJumpR` sprites. |
| Fire flamethrower | **Space** | **[D]** | *"Fire flamethrower - spacebar"*; `imgFireL`/`imgFireR`, `FIRE.WAV`, `WAFFE.WAV`, and the extracted `flamethrower-fire-*.png` frames. |
| Turn around | tap the opposite walk arrow | **[D]** | Walkthrough instructs *"turn around and shoot"* / *"quickly turn"*; there is no separate turn key. |
| Start / advance | **Enter** | **[?]** | `ENTER.WAV` exists and `frmStart` has no buttons, so a key must start the game. The exact key was not confirmed. |
| Quit / end game | **Esc** | **[V]** | `RSTEIN.EXE` contains the message: *"Zum Beenden des Spiels Esc betätigen."* ("To end the game, press Esc.") |
| God mode | type **`GODMODE`** | **[?]** | Strings `.GODMODE` and `Godmode aktiviert` are in `RSTEIN.EXE`. The trigger method (typed during play vs. title) is not confirmed. |

Notes:

* The game polls the whole keyboard (`GetKeyboardState`) rather than using
  clickable controls: the three level forms (`frmScreen1/2/3`) contain only
  image/sprite and timer controls, **no buttons**. So keyboard input is
  certain; the exact arrow/space mapping is the fan-documented part. **[V]**
* Only `Esc` was confirmed by an in-binary string; it is safe for a wrapper.

---

## 4. Scoring

From the original German readme (`assets/original/README.TXT`), the 1997
high-score formula is: **[V]**

```
score = points_collected
        - (seconds_played x 10)
        + (unused_shots x 1000)
```

* Every second cost **10 points**.
* Every unfired shot was worth **1000 bonus points**.

The original ending screen (extracted as `reference/extracted/highscore-outro.png`)
shows this breakdown in German:

| German label | English |
| --- | --- |
| *Gesammelte Punkte* | Points collected |
| *Punkte für Restmunition* | Points for remaining ammo |
| *minus Spieldauer* | minus play time |
| *DEIN HIGHSCORE-ERGEBNIS* | Your high-score result |

The WAV files `P2000.WAV`, `P5000.WAV` and `P10000.WAV` are point-pickup
sounds, strongly implying **2000 / 5000 / 10000-point** awards. **[?]**
`P10000.WAV` is longer, suggesting a bigger reward jingle.

---

## 5. Levels, enemies and items

Enemy/object names below come from the Visual Basic form control lists inside
`RSTEIN.EXE` (see `reference/extracted/manifest.json` → `forms`); level themes
and the face order come from the archived walkthrough and the RammWiki summary.

### Level 1 — subterranean cavern / water ("underground" → mountains) **[D]**
`frmScreen1` controls include: `imgHeli`, `imgHeli1`, `imgMonster`,
`imgScholle`, `imgEiszapfen` (icicles), `imgFackel` (torch), `imgGrab` (grave),
`imgUrne`, `imgEisfalle` (ice trap), `imgExplosionKlein/Gross`, `imgKopf1/2`,
`imgSterben`, `imgBlack`, `imgFade`.

Walkthrough beats: light torches, break stalactites, find Schneider's and
Flake's faces, jump the new platforms, kill the blue water monster, shoot two
Apache helicopters (the second comes from behind). **[D]**

### Level 2 — concert venue **[D]**
`frmScreen2` controls include: `imgSchabe` (cockroach), `imgPuppe1/2`
(dolls), `imgBoot` (boat/raft), `imgWaffe` (weapon item), `imgPfeilL/R`,
`imgKopf3/4`, `imgTauch`, `timerWaffeFire`.

Walkthrough beats: kill two beetles, jump for the "breathing hose", shoot
Paul's and Till's faces, kill the floating orb, ride the raft for an extra
life, shoot floating dolls. **[D]**

### Level 3 — underwater / beach (*Sehnsucht* artwork) **[D]**
`frmScreen3` controls include: `imgIgel` (sea urchin/spikes), `imgEgo` (the
player's clone), `imgFass` (falling barrels/"depth charges"), `imgMonster`,
`imgImplosion`, `imgKopf5/6`, and mirrored actor frames
(`imgManStepLO/RO`, `imgManJumpLO/RO`, `imgFireLB/RB`).

Walkthrough beats: shoot Richard's face, survive the clone that appears
**behind** you (jump over it, turn, shoot), jump the sea-urchin spikes, dodge
depth charges, shoot the "Hawaiian girl" monster, then Olli's face, then win.
The German forum thread confirms the same trick: *"jump forward, quickly turn
around and shoot the opponent (then he becomes visible)"*. **[D]**

The six band-member heads (`imgKopf1`…`imgKopf6`) correspond to the walkthrough
face order Schneider, Flake, Paul, Till, Richard, Olli. **[?]** (order is
documented; the exact mapping to `imgKopfN` is not).

---

## 6. HUD and endings

* **HUD labels** (from the form data): `lblPunkte` (score), `lblMunition`
  (ammo), `imgLeben` (life icon). **[V]**
  The gameplay screenshot shown on RammWiki shows the 640×480 scene with a red
  bar at bottom-left and a green score (e.g. `15000`) bottom-centre. **[D]**
* **Ending:** after level 3 the game shows the *glückwunsch!* screen with the
  score breakdown, a **red button** (`btnSave` + `imgKnopf`) labelled
  *"Ja, ich will am Wettbewerb um den höchsten Highscore teilnehmen"*, and the
  Motor Music / Oliver Czok credits. **[V]** — extracted at
  `reference/extracted/highscore-outro.png`.
* **High-score file:** pressing the button writes an encrypted result to
  **`C:\HISCORE.TXT`**. The original readme explains it had to be emailed or
  faxed to enter the 1997 contest; that contest is long over. **[V]**
  **The wrapper must not re-implement submission**, and should say so.
* **Cheat:** the string `Godmode aktiviert` in `RSTEIN.EXE` indicates a
  built-in god mode. **[?]**

---

## 7. Wrapper implementation notes

* **Resolution / depth:** 640×480, 256-colour palette, native 4:3. The six
  640×480 backgrounds are extracted (see §8); the playfield is drawn by
  `RAMM16.DLL` sprite routines (`PAINTSPRITE`, `PAINTMULTISPRITE`,
  `COPYTRANSPARENT`, `SCROLLTEXT`, `FADEBITMAP`). **[V]**
* **Transparency:** sprite sheets use a flat blue background colour as the
  colour key (the same colour that fills the sprite-sheet PNGs). Some objects
  also ship explicit mask bitmaps (`imgEisfalleMsk`, `imgEiszapfenMsk`). **[V]**
* **Keyboard:** emulate ←, →, ↑ and Space, plus Esc to quit. Enter to start is
  a safe default. **[D]/[?]**
* **Audio:** the WAV set is preserved in `assets/original/WAV/`
  (`FIRE`, `WAFFE`, `ENTER`, `TOD1/2`, `LEBEN`, `P2000/5000/10000`, `MONSTER`,
  `SCHABE`, `GUMMI`, `HELI3`, `CHORAL`, `BOOOM1`). **[V]**
* **Read-only / legal:** keep the wrapper read-only toward RammWiki and do not
  ship the game binaries as project-owned content. See `assets/SOURCES.md`.

---

## 8. Extracted original assets

Generated by `reference/extract_game_assets.py` into `reference/extracted/`
(each PNG notes the byte offset of the source `BM` record in `manifest.json`).

| File | Content |
| --- | --- |
| **`highscore-outro.png`** | **Best "instructions" screen: the ending with the score breakdown and the contest button.** |
| `title-screen.png` | 640×480 title / start screen (`frmStart`). |
| `level1-cavern.png` | Level 1 backdrop (cavern, water, flaming statues). |
| `level2-concert.png` | Level 2 backdrop (Rammstein stage). |
| `level3-beach.png` | Level 3 backdrop (beach / palm trees). |
| `game-over.png` | "game over" screen. |
| `player-spritesheet.png` | Player walk/jump animation frames. |
| `flamethrower-fire-a.png`, `flamethrower-fire-b.png` | flame/weapon frames. |
| `helicopter.png`, `grave.png`, `monster-a.png`, `monster-b.png`, `woman-doll.png`, `sea-urchin.png` | enemy/object sprites. |
| `band-face-a.png`, `band-face-b.png` | floating band-member faces. |
| `button-knob.png` | ending-screen button art. |
| `bitmap_NN_*.png` | all remaining embedded bitmaps. |
| `manifest.json` | offsets, sizes and the parsed VB3 form/control lists. |

Re-run at any time with:

```bash
python3 reference/extract_game_assets.py
```

---

## 9. Sources and confidence

| Source | Used for | Reliability |
| --- | --- | --- |
| `assets/original/README.TXT` (1997) | requirements, scoring, high-score file, contest | **primary / [V]** |
| `assets/original/RSTEIN.EXE` (1997) | controls evidence, forms, HUD names, Esc, cheat, credits | **primary / [V]** |
| Embedded bitmaps in `RSTEIN.EXE` | screens, sprites, ending screen | **primary / [V]** |
| Archived walkthrough, `rammsteinniccage.com/downloads/games/computerspiel_walkthrough.html` (Wayback capture 2011; credit "Stephen from eifersucht.net") | **exact key bindings**, level walkthrough, face order | secondary / **[D]** |
| RammWiki, *Rammstein Computerspiel für Windows (game)* | release, plot, level themes, gameplay goal | secondary / **[D]** |
| RA-Forum thread *Rammstein-Pc Spiel* (2006–2007) | level-3 clone / jump trick confirmation | secondary / **[D]** |

### Open questions / guesses for runtime testing

* Is **Enter** really the "start" key, and does the title screen also react to
  a mouse click or the fire key? **[?]**
* How exactly is `GODMODE` entered, and what does it actually do? **[?]**
* Exact point values of enemies and pickups (only `P2000/5000/10000` sounds
  hint at values). **[?]**
* Exact mapping of `imgKopf1`…`imgKopf6` to the six band members. **[?]**
* Whether the player can freely walk both directions or the level auto-scrolls
  toward a fixed direction (fan text says "constantly moving left"; the
  walkthrough and left/right sprite sets imply free movement). **[?]**
