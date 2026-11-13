# Power Up Your Body with NAD+ — ZÉLL-V NMN launch mini game

A touch-first drag-and-drop game for the booth iPad and guests' phones. It uses plain HTML, CSS and JavaScript with no build step and no CDNs, and runs fully offline after the first load (PWA).

```
index.html            page shell (all screens)
css/styles.css        styling — every colour is a CSS variable in :root
js/main.js            screen flow, game state, reveal, cards, idle reset, kiosk, admin
js/drag.js            Pointer-Events drag & drop + organ hit testing
js/shield.js          Game 2: AstaReal® Astaxanthin shield (canvas)
js/content.js         ALL copy, organ text, top-5 list and settings  ← marketing edits this
assets/body.svg       the body; each organ is <g class="organ" data-organ="...">
assets/fonts/         self-hosted Syne + Inter (SIL Open Font License)
assets/icons/         app icons
sw.js                 service worker (offline cache)
manifest.webmanifest  PWA manifest
_headers              Cloudflare Pages cache headers
tests/e2e.mjs         automated hit-detection + flow tests (dev only)
```

## Run locally

The game must be served over HTTP. ES modules don't load from `file://`. Pick one:

```bash
python -m http.server 8080        # then open http://localhost:8080
npx serve .                       # or any static server
```

To test on a phone on the same Wi-Fi, open `http://<your-computer-IP>:8080`. Over plain HTTP on an IP address the game works, but offline mode doesn't. Service workers need HTTPS or `localhost`. Use the deployed URL to test offline.

Add `?nosw=1` to the URL to skip the service worker while you edit files.

## Edit the copy (`js/content.js`)

- Change only the text between the quotes. Keep the quotes, commas and keys.
- `en` is the master copy. `ms` (Bahasa Melayu) and `zh` (Simplified Chinese) are full **draft translations**. Have a native speaker check them before the event. If you change an English line, update the same key in `ms` and `zh`. Any key you remove from `ms`/`zh` falls back to English automatically.
- Every health explanation is marked `// REVIEW` for brand/regulatory sign-off. Search the file for `REVIEW`.
- Some lines are small functions, such as `remaining: (n) => \`${n} orbs left\``. Edit the words inside the backticks and leave `${n}` where it is.
- Other useful keys:
  - `end.ctaText`: the gift message ("Show this screen at the counter…")
  - `disclaimer`: the footer on the Learn and End screens
  - `badges`: the badge names
- To hide a language, remove it from `CONFIG.languages`.

**After deploying an edit:** the offline cache updates in the background. Each device shows the new text on its *second* load. To force every device to update right away, bump `VERSION` in `sw.js` (for example `'v1'` → `'v2'`).

## Change the correct answers

In `js/content.js`:

```js
topPicks: ['heart', 'brain', 'muscles', 'liver'],
```

Valid ids: `skin, brain, eyes, lungs, heart, liver, stomach, kidneys, intestines, muscles`. The guest gets **one NAD+ orb per organ in this list**, so adding or removing an organ changes the number of orbs. The score ("You matched 3/4"), "Perfect Match! 4/4", the "Our top 4" chips and the Learn card order all follow the list. If you change its length, also check the badge thresholds in `CONFIG.badges` (`min` = score needed).

## Game 2: Astaxanthin Shield

The start screen has two tabs: **NAD+ Body Game** and **Astaxanthin Shield**.

In the shield game, free radicals rush down towards the guest's cells. The guest drags the red **AstaReal® Astaxanthin** shield left and right to block them. They have 3 hearts and must survive 50 seconds, and the game speeds up as time runs out. Afterwards, swipe cards explain the meaning: the shield represents AstaReal® Astaxanthin, which helps protect cells from free radicals and oxidative stress. The End screen then shows a shield badge (Antioxidant Guardian / Cell Defender / Brave Defender) and the gift CTA.

- **Copy:** `shield: { ... }` inside `en`, `ms` and `zh` in `js/content.js`. The explanation cards are `shield.cards` and are marked `// REVIEW`.
- **Settings:** `CONFIG.shield` in `js/content.js`:

| setting | default | meaning |
|---|---|---|
| `durationSeconds` | 50 | survive this long to win |
| `lives` | 3 | hearts |
| `startSpawnSeconds` / `endSpawnSeconds` | 1.15 / 0.5 | gap between free radicals at the start / end |
| `startSpeed` / `endSpeed` | 0.24 / 0.44 | fall speed in screen-heights per second |
| `shieldWidth` | 0.27 | shield width as a fraction of the screen |

To make it easier, raise `startSpawnSeconds`/`endSpawnSeconds`, lower the speeds or widen the shield. The admin screen also counts shield plays and wins.

## iPad, full screen and touch

The game is built for touch first and is tested on iPad landscape (1180×820), iPad portrait (820×1180), iPhone (390×844) and a small Android phone (360×740), including turning the iPad mid-game.

- **Full screen button** (top-right, next to the language switch):
  - On iPad (Safari, iPadOS 12+), Android and desktop, tap it to go full screen and tap it again to leave.
  - iPhone Safari does not allow web pages to go full screen, so on iPhone the button shows how to **Add to Home Screen** instead. Opened from its home-screen icon, the game runs with no browser bars.
  - The button hides itself when the game is already running as a home-screen app.
- **Touch protection everywhere** (not only in kiosk mode):
  - pinch zoom, double-tap zoom and long-press menus are blocked so a stray second finger can't break a drag
  - learn-card text can still be long-pressed outside kiosk mode
- **Touch targets:** every button is at least 44×44 px (Apple's minimum), and the tests check this on each device size.
- **Rotation:** turning the device mid-game is fine; drop detection and the shield game re-fit to the new size.

## Kiosk mode (booth iPad)

Open the game with `?kiosk=1`, for example `https://your-site.pages.dev/?kiosk=1`. This:

- also blocks text selection everywhere, including learn cards
- goes full screen on the first tap, and on the next tap again if a guest swipes out of full screen (browsers only allow full screen after a tap, never automatically on page load)
- always resets to English after an idle timeout

Recommended booth iPad setup (most robust, no browser bars at all):

1. Open the kiosk URL in Safari → Share → **Add to Home Screen** and launch it from the icon. It opens full screen with no browser bars and works offline.
2. Settings → Accessibility → **Guided Access** on. Launch the game and triple-click the side (or Home) button to lock the iPad to it, so guests can't leave the app or pull down Control Centre.
3. Settings → Display & Brightness → Auto-Lock → **Never**, and keep the iPad on its charger.
4. Optional: Settings → Accessibility → Touch → turn off **Shake to Undo**, and in Guided Access options turn off the volume buttons.

If you use Safari directly instead of the home-screen icon, use the full screen button (or the first tap in kiosk mode). Safari may show a small "×" in the corner while full screen; Guided Access stops guests from using it to leave.

### Idle auto-reset

`CONFIG.idle` in `content.js`:

| setting | default | meaning |
|---|---|---|
| `timeoutSeconds` | 60 | seconds of no touches before the game returns to the Start screen |
| `warningSeconds` | 5 | a "Still there?" countdown runs for the last N seconds; any tap cancels it |
| `kioskOnly` | `false` | `true` = only auto-reset with `?kiosk=1` |

> With the default (`kioskOnly: false`), a guest's **own phone** also resets after 60 s. That includes the End screen they need to show at the counter. If guests will walk from the booth to the counter, set `kioskOnly: true` and run the booth iPad with `?kiosk=1`.

### Booth stats (hidden admin)

Tap the **ZÉLL-V NMN logo 5 times** quickly to see total plays, perfect matches, perfect rate and the most-picked organs. Stats are stored per device in `localStorage`. "Reset stats" asks for a second tap to confirm.

## Deploy to Cloudflare Pages

**Dashboard (no Git needed):** Cloudflare dashboard → Workers & Pages → Create → Pages → **Upload assets**. Drag in this folder (it must contain `index.html` at the top level) and deploy.

**Git:** push the folder to a repo, then Pages → Connect to Git. Use framework preset **None**, leave the build command empty and set the output directory to `/`.

**CLI:**

```bash
npx wrangler pages deploy . --project-name zellv-nad-game
```

`_headers` makes `sw.js`, JS and CSS revalidate on every load, so edits arrive promptly, and caches the fonts long-term. Generate the QR code from the final `https://…pages.dev` URL, or from your custom domain.

The `tests/` folder is never cached by the service worker. It is harmless to deploy, but you can leave it out.

## Accessibility

- **Tap-to-place:** tap an orb (it lifts and glows), then tap a body part.
- **Keyboard:** Tab to an orb and press Enter to select it, then Tab to an organ and press Enter. Pressing Enter on an organ with no orb selected uses the next free orb.
- Every organ has an `aria-label`, and placements are announced in an `aria-live` region.
- `prefers-reduced-motion` turns off confetti, particles, pulses and fly animations.

## How the drop detection works (`js/drag.js`)

Each organ's visible shape is sampled into a polygon. A drop point is resolved like this:

1. **Inside a visible organ** → that organ. Where two overlap, the one drawn on top wins, so the heart beats the lungs.
2. **Within 22 screen px of organs** (the invisible padded zone) → the **nearest** organ outline. A big organ's padding can never steal a drop that is visibly closer to a small neighbour.
3. Otherwise, **on or near the body silhouette** → Skin. Anywhere else, the orb returns to the tray.

On touch screens the dragged orb floats 34 px above the fingertip so the target stays visible. The drop is judged at the orb's centre, and the organ under it highlights and shows its name while dragging.

The figure's eyes follow the held orb. They also glance at an orb selected for tap-to-place, watch it land, then return to centre. Tune how far the irises move with `EYE_MAX_X` / `EYE_MAX_Y` in `js/main.js`.

To change the body art, keep the structure in `assets/body.svg`: one `<g class="organ" data-organ="id" data-anchor="x,y">` per organ, with a `<path class="organ-shape">` inside. The hit areas are read from those paths automatically.

## Tests

```bash
python -m http.server 8765          # in one terminal
node tests/e2e.mjs                  # needs Node 22+ and Chrome or Edge installed
SHOTS=./shots node tests/e2e.mjs    # also saves screenshots
```

The script drives headless Chrome/Edge with **emulated touch**. It drags orbs onto points just inside each organ's edge where it faces a close neighbour (heart↔lungs, liver↔stomach, eyes↔brain, kidneys↔intestines and more), on four screen sizes: phone, small Android, iPad landscape and iPad portrait. It also checks tap-to-place, undo, bounce-back on a filled organ, drop-outside-returns-to-tray, the reveal copy, the card order, language switching and the admin stats.
