# Verification record

Implementation and main verification: 2026-10-15. Final offline verification and packaging: 2026-10-16. Environment: Linux, Node 24.19.0, Chromium via Playwright. No commercial audio was downloaded or bundled. Audio checks use a locally synthesized quiet PCM waveform; lyric test text is original.

## User story

Import an original audio file → extract source metadata → persist the original Blob → play it through the native decoder → seek from timed lyrics → change the queue and preferences → reload without autoplay → continue from the saved state, including while offline.

## Automated checks

| Check               | Result / evidence                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`       | Completed; reproducible dependency lock committed                                                                                                                         |
| `npm run lint`      | Pass                                                                                                                                                                      |
| `npm run typecheck` | Pass, TypeScript strict                                                                                                                                                   |
| `npm run test`      | 36 tests across library, lyrics, queue and media Worker                                                                                                                   |
| `npm run build`     | Pass; emitted static Vite app and versioned offline shell                                                                                                                 |
| `npm run test:e2e`  | Four browser stories: source failure recovery; demo/search/favorites/queue/playlists/theme; real WAV playback/lyrics/restore; responsive navigation/player/reduced motion |
| `npm run test:pwa`  | Production shell boots offline; metadata parser imports a WAV offline; native audio plays; imported track survives offline reload                                         |
| Metadata scanner    | 16-bit / 48 kHz stereo WAV scanned correctly; adjacent LRC extracted; encoded Chinese filename URL; original source retained                                              |
| Worker dry run      | Wrangler bundled Worker, about 40 KiB before gzip; no deployment performed                                                                                                |

The Worker tests cover inclusive byte boundaries, open and suffix ranges, malformed and multipart ranges, unsatisfiable 416 responses, exact 206 body/headers, HEAD without reading a body, stale If-Range, ETag 304, missing objects, method/origin/path rejection, and authorization that fails closed. A generated RSA key/JWKS signs a real JWT; valid issuer/audience/expiry succeeds, wrong audience and expired tokens fail before R2 is read. R2 itself is mocked in local tests.

The browser playback story observes `HTMLAudioElement.paused`, `currentTime` and the actual decoder rather than trusting a play icon. It checks line-tap seeking, paused restore, bilingual lyrics persisted in IndexedDB and manual-scroll return behavior. Source failure recovery verifies that a remote 404 does not prevent a later local file from playing.

## Visual and interaction rounds

1. **Initial implementation / visual polish:** inspected desktop and phone Home; corrected overly dark SVG grain composition, kept original covers distinct, adjusted responsive grids and maintained content below floating controls.
2. **Motion / material polish:** verified dark/light/system palettes, modal and queue entry/exit, shared artwork transitions, focus restoration, compact mobile navigation, reduced-motion behavior, pointer highlights, scroll-driven specular position and subtle button release feedback.
3. **Player / lyrics polish:** inspected desktop two-column lyrics and phone player/lyrics layouts, active-line contrast, translation hierarchy, progression controls and empty lyric state. Confirmed tap-to-seek and manual tracking suspension with actual imported audio.
4. **Final reliability:** fixed offline cache lookup when the server emitted `Vary: Origin`, precached lazy decoder metadata chunks, fixed duplicate error notifications, verified browser refresh and no forced autoplay, then reran the affected checks.

Responsive overflow assertions cover 320, 390, 768, 1440 and 2560 CSS-pixel widths. Visual inspection covers 390×844 phone, 768×1024 tablet and 1440×1000 desktop. Screenshots of player lyrics use an explicitly synthetic QA recording and original lyric text, not the user's music.

## Screenshots

- [Desktop Home, dark](previews/home-desktop-dark.png)
- [Tablet Home, light](previews/home-tablet-light.png)
- [Phone Home, light](previews/home-mobile-light.png)
- [Phone Home, dark](previews/home-mobile-dark.png)
- [Desktop player with lyrics](previews/player-lyrics-desktop.png)
- [Phone player](previews/player-mobile.png)
- [Phone lyrics](previews/player-lyrics-mobile.png)

## Not established by these checks

- Production Cloudflare account permissions, Access policy, custom-domain routing and real R2 latency/range behavior: credentials and a target domain were not supplied.
- Safari / iOS or Firefox playback, hardware codec availability, OS background suspension, Bluetooth / lock-screen behavior and actual DAC output.
- Sample-accurate gapless playback, bit-perfect output or sustained 60/120 fps on physical devices. The spring integrator is tested at 60/120 time steps; this is not a hardware performance benchmark.
- Cross-device sync, TTML adapter or complete playlist administration. These remain outside the implemented first-stage behavior documented in the README.

The app is ready to run and build locally. Actual private deployment and testing against the owner's real audio collection are the next integration step.
