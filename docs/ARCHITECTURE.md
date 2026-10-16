# Architecture and behavior

## Data and privacy boundaries

`public/library.json` is an empty versioned index. Runtime validates the index with Zod and merges it with explicit browser imports. When neither source has tracks, a small metadata-only preview collection is shown. Real imports replace the preview collection rather than inflating listening history with fake data.

Every track has a stable ID. A remote scan uses a truncated SHA-256 content hash; a browser import uses filename, size and modification time to replace repeat imports without hashing a potentially huge WAV into memory. Album grouping uses album artist plus album title. Search applies Unicode NFKC normalization and case-insensitive, multi-term matching.

IndexedDB has three object stores:

| Store    | Data                                                                                  |
| -------- | ------------------------------------------------------------------------------------- |
| `state`  | Versioned player settings, current ID, position, queue, history, favorites, playlists |
| `files`  | Explicitly imported original Blob, extracted artwork and metadata                     |
| `lyrics` | User-attached LRC / rich JSON text keyed by Track ID                                  |

Blob URLs are regenerated on startup; temporary object URLs are not persisted. Persistent state excludes live decoder status, modal state and errors. Writes are coalesced once per second and flushed on backgrounding. A crash within that interval can lose the most recent second of progress. Storage failures surface as a toast; quota failures do not destroy previous imports.

## Audio lifecycle

One `NativeAudioEngine` owns one active `HTMLAudioElement`, plus a detached metadata preloader for the immediate next source. No AudioContext is created. Source files remain unchanged. Track selection, intent to play and decoder events are separate states. `playing`, `waiting`, `stalled`, `seeking`, `seeked`, `error`, `ended`, `durationchange` and buffered ranges update UI state.

Source changes invalidate pending play promises so late rejection from the previous source cannot overwrite a new track. Restored sessions load metadata, seek after metadata is available and stay paused until a user gesture. Playback history is credited after five seconds of playback position (or halfway through a shorter file), not on clicking preview metadata. A seek past that threshold while playing counts as a listen; this is a personal history heuristic, not analytics-grade listening duration.

Queue entries have independent IDs so duplicate songs can coexist. The queue stores upcoming items, while a separate back stack supports Previous. Repeat One applies on natural completion; an explicit Next advances. Repeat All rebuilds the listening collection at the end. Shuffle chooses randomly from remaining entries, avoiding repeats within that cycle.

`audio.canPlayType()` is an advisory check. A browser may advertise a container while lacking a specific embedded codec; decoder errors remain handled. A 404, access failure, unsupported codec or autoplay refusal never simulates successful playback. Media Session handlers are registered only where supported.

## Lyrics

```ts
interface LyricsDocument {
  lines: LyricsLine[];
  title?: string;
  artist?: string;
  offset: number;
}
interface LyricsLine {
  startTime: number;
  endTime: number;
  text: string;
  translation?: string;
  pronunciation?: string;
  words: LyricsWord[];
}
interface LyricsWord {
  startTime: number;
  endTime: number;
  text: string;
}
```

All times are seconds. LRC `[offset:...]` is milliseconds and is applied during normalization. Rich JSON provides normalized absolute times; its `offset` records provenance rather than applying a second time shift. Repeated timestamps expand to multiple lines. Same-time text pairs become a primary line and translation. Empty timed lines denote instrumental intervals. A final end time uses the track duration where available. Enhanced LRC `<mm:ss.xx>` becomes word timing without adding or fetching words.

Example rich JSON with entirely original test text:

```json
{
  "offset": 0,
  "lines": [
    {
      "startTime": 0,
      "endTime": 5,
      "text": "A little room to breathe",
      "translation": "留一点呼吸的空间",
      "words": [
        { "startTime": 0, "endTime": 2, "text": "A little room " },
        { "startTime": 2, "endTime": 5, "text": "to breathe" }
      ]
    },
    { "startTime": 5, "endTime": 12, "text": "", "words": [] }
  ]
}
```

Binary search identifies the active line. The scroll engine considers the line's measured height and a 38% viewport focus position; a damped spring preserves velocity across target changes. Frame deltas are clamped when returning from background. Manual wheel, touch, scrollbar or keyboard interaction suspends tracking; a return button appears after 1.8 seconds. Selecting a lyric seeks and restores tracking. There is no `scrollIntoView` tracking loop. Reduced motion positions directly without spring travel.

Word opacity is interpolated from the native media clock, with at most 0.6 seconds of interpolation between native updates. It uses a neutral white highlight, not colored karaoke sweeping. TTML can normalize into the same data model but is not included yet.

## Material and motion system

`glass/materials.css` defines UltraThin / Thin / Regular / Thick and semantic surfaces for navigation, tab bar, player, mini player, controls, menus, popovers, modals, sheets, search, queue and lyric controls. Blur, tint, opacity, saturation, brightness, border, specular reflection, chromatic tint, inner highlights and shadows are independent CSS properties/layers.

Pointer position moves specular highlights; focus changes edge emphasis; press changes geometry. High enables subtle SVG displacement on compact optical surfaces. Auto chooses Balanced or Reduced using CPU concurrency and reduced-motion preference. It does not run an FPS profiler. Unsupported backdrop filters fall back to opaque surfaces. Browser glass is explicitly an approximation of an optical material, not a native Apple compositor.

Palette extraction uses downsampled image pixels, quantized color bins and luminance / warm-cool ranking. It produces dominant, secondary, highlight, shadow, warm and cool colors. CORS failures use a known readable fallback. The player composes several low-frequency color fields and a dark foreground contrast veil. Selected controls remain semantically blue and favorites remain pink.

Framer Motion tokens share spring stiffness, damping and mass. Shared artwork IDs connect album card → detail, mini player → full player, and artwork → expanded artwork. Lyrics enter with a short position/blur crossfade. Queue and dialogs use the sheet spring. CSS duration tokens coordinate opacity, controls and typography.

## PWA and deployment

The Vite build versions the shell cache from the emitted index and precaches all emitted JS/CSS chunks, including lazily used metadata parsers. It never enumerates or caches an audio library. Runtime fetch caching allows same-origin application resources, public metadata, artwork and lyrics; Range requests, audio URLs and all private `/media/*` requests bypass it. Local files and user-attached lyrics are independently available from IndexedDB.

Cloudflare Worker streams R2 bodies directly and validates a single byte range. It handles open-ended and suffix ranges, 206 / 416, `Accept-Ranges`, `Content-Range`, `Content-Length`, MIME type, ETag, HEAD and If-Range. It checks the object ETag between HEAD and GET to detect concurrent replacement. Multipart requests are rejected, not silently expanded into a full download.

Cloudflare Access authorization validates RS256 signature, issuer, audience and expiry against the team's JWKS. Missing configuration returns 503; missing or invalid authorization returns 403. The bucket remains private and no R2 access key appears in browser code. The app itself must also be protected by an Access policy; hiding only the media path is insufficient for a private site.
