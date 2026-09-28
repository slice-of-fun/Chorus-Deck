# Phase 1 — Migration Assessment (Electron → Tauri 2)

Status: **analysis only. No source file has been modified.**
Subject: `Chorus-Deck` v5.1.0 · 262 source files · 55,287 lines
Date: 2026-09-28

---

## 0. Executive summary

The Vue/TypeScript frontend is in good shape and should be carried over almost
intact. The migration is therefore **not** a frontend project — it is a project to
replace ~4,800 lines of Electron main-process code with ~2,500 lines of Rust
plus a Tauri shell, and to fix a set of defects that already exist today.

Three findings dominate the plan:

1. **The default streaming path is already broken.** `unblock-music` has no
   `ipcMain` handler, so the fallback strategy for `migu/kugou/kuwo/pyncmd` — 4 of
   the 5 default sources — always fails. Two further features (`ytm:play`,
   sleep-timer `show-notification`) also have no handler. These must be recorded
   as *pre-existing* in the parity checklist or they will be misread as migration
   regressions.
2. **Media keys will regress unless Rust work is scheduled.** Electron gets
   Windows SMTC / macOS Now Playing for free from Chromium's MediaSessionService.
   Tauri 2 ships **no** equivalent. The WebView2 `navigator.mediaSession` API is
   not wired to SMTC by a Tauri host, so a native SMTC implementation is required
   in Rust.
3. **Audio playback lives in the WebView (Option A).** Per §11 of this document,
   audio playback is retained in the WebView (Chromium decodes mp3/aac/opus/wav/flac
   natively). The EQ Web Audio graph, background playback when hidden, and gapless
   playback limitations all remain. SMTC / media keys still require a Rust
   implementation either way.

---

## 1. Current architecture

Three processes, as expected for Electron:

```
main/       24 files   Electron main: window, tray, cache, downloads, MPRIS,
                        Discord RPC, YouTube Music client, remote-control HTTP
                        server, global shortcuts, auto-update
preload/     2 files   contextBridge; 3 namespaces; ~100 IPC channels total
renderer/  ~232 files  Vue 3 + TS; 106 .vue; 23 routes; Naive UI; Tailwind;
                        18 Pinia stores; 16 API modules; IndexedDB + localStorage
shared/      4 files   types/constants used by both sides
```

Startup order is fixed in `src/main/index.ts:68-110` (`initialize()`), and the
main `BrowserWindow` is created at `index.ts:85` — after 7 modules are already
initialised. `window.ts:260` binds window-size handlers to a `null` window and is
a no-op until `window.ts:410`.

**Audio is 100% renderer-side.** No `AudioContext`, no `HTMLAudioElement`, no
codec work exists in `src/main`. Main only does audio *file I/O* (downloads, tag
writing, metadata parsing, cover extraction, disk cache).

---

## 2. Electron-specific dependencies

| Package | Actually used? | Notes |
|---|---|---|
| `electron` `^40.10.6` | yes | the shell itself |
| `electron-vite` `^5.0.0` | yes | dev/build orchestrator |
| `electron-builder` `^26.0.12` | yes | NSIS / dmg / AppImage / deb / rpm |
| `electron-store` `^8.2.0` | yes | **3 instances**: `config`, `disk-cache`, `download-queue` |
| `electron-updater` `^6.6.2` | yes | `autoDownload=false` |
| `electron-window-state` `^5.0.3` | **NO** | declared, never imported — state is hand-rolled in `window-size.ts` |
| `@electron-toolkit/preload` `^3.0.2` | yes | exposes a full copy of `process.env` to the renderer |
| `@electron-toolkit/utils` `^4.0.0` | yes | `is.dev`, `optimizer` |
| `discord-rpc` `^4.0.1` | **NO** | declared, never imported — RPC is hand-rolled over `ws` |
| `@material/material-color-utilities` | **NO** | declared, never imported |
| `mpris-service` `^2.1.2` | yes | Linux MPRIS |
| `@httptoolkit/dbus-native` `^0.1.5` | yes | GNOME Shell TrayLyric |
| `express` `^4.22.1` + `cors` | yes | LAN remote-control server, port 31888 |
| `ws` `^8.22.0` | yes | Discord Gateway |
| `node-machine-id` | dead | only in `deviceInfo.ts`, which is never imported |
| `flac-tagger`, `node-id3`, `music-metadata`, `file-type` | yes | tag write / read / sniff |
| `font-list` | yes | system font enumeration |
| `jsencrypt`, `crypto-js` | renderer | LX Music handshake crypto |
| `pinia-plugin-persistedstate` | renderer | 5 of 18 stores |

Node-only code that leaves the app entirely on migration: all of the above except
`pinia-plugin-persistedstate`, `jsencrypt`, `crypto-js`.

---

## 3. Vue / frontend dependencies

`vue 3.5` · `vue-router 4.6` · `pinia 3.0` · `naive-ui 2.45` · `tailwindcss 3.4` ·
`sass` · `animate.css 4.1` · `remixicon 4.9` · `@vueuse/core 11` ·
`unplugin-auto-import` · `unplugin-vue-components` · `tunajs` (EQ only) ·
`howler 2.2` (EQ service only — **the EQ service has zero consumers**) ·
`pinyin-match` · `tinycolor2` · `marked` · `lodash`.

**All of these survive the migration unchanged.** That is the point of the plan.

---

## 4. Node-specific functionality

| Concern | Where | Migration destination |
|---|---|---|
| Frameless window + custom titlebar IPC | `window.ts` | Tauri window config + `data-tauri-drag-region` |
| Window bounds persistence | `window-size.ts` (583 L) | Tauri window-state plugin, or 60 lines of Rust |
| Content-zoom / DPI scaling | `window-size.ts:372-423` | Rust, on `WindowEvent::ScaleFactorChanged` |
| Mini-player mode (340×64) | `window.ts:167-243` | Tauri window, same logic |
| Tray + macOS status-bar trays | `tray.ts` | `tauri::tray` |
| Desktop-lyric window (transparent, drag, click-through) | `lyric.ts` (379 L) | Tauri window, `set_ignore_cursor_events` |
| Global shortcuts | `shortcuts.ts` (398 L) | `tauri-plugin-global-shortcut` + `src/shared/shortcuts.ts` reused verbatim |
| `local://` protocol with HTTP Range | `fileManager.ts:23-87` | Tauri `register_uri_scheme_protocol` — **must add a path jail** |
| Audio disk cache + LRU | `cache.ts` (1090 L) | Rust |
| Download manager (resume, tag, artwork, lyrics) | `downloadManager.ts` (1038 L) | Rust |
| Local music scanner | `localMusicScanner.ts` | Rust |
| NetEase login window (cookie scrape) | `loginWindow.ts` | Tauri window + Rust HTTP |
| YouTube Music InnerTube client | `ytmusic.ts` (597 L) | Rust |
| Discord Gateway RPC | `DiscordPresenceManager.ts` (387 L) | Rust (`tokio-tungstenite`) |
| MPRIS + GNOME TrayLyric | `mpris.ts` (267 L) | Rust (`zbus`) |
| Auto-update | `update.ts` | `tauri-plugin-updater` |
| System fonts / accent colour / device id | `fonts.ts`, `theme.ts`, `deviceInfo.ts` | Rust / Tauri |
| LX-Music HTTP bridge | `lxMusicHttp.ts` | Rust — **must add an allowlist** |

---

## 5. What stays in TypeScript

* All 106 `.vue` components and every view.
* Routing (23 routes, already `createWebHashHistory`).
* All 18 Pinia stores, after splitting `playerCore`/`player` overlap.
* `src/renderer/api/*` — 16 modules, all catalog/HTTP clients. The axios
  instance and its retry/timeout logic move almost unchanged.
* `src/renderer/services/*` — `audioService`, `playbackController`,
  `preloadService`, `yrcParser`, `LxMusicSourceRunner`, the LX sandbox worker.
* All 19 utils, including the 524-line `linearColor.ts` canvas colour extractor.
* `src/shared/shortcuts.ts` (368 L) — pure, platform-agnostic, reusable in both
  worlds.

---

## 6. What moves to Rust

Playback is **not** on this list — see §11 of this document's "Audio decision".

* Everything in the table above.
* SQLite layer + migrations (`rusqlite`, bundled).
* Structured error enum (§29) with a serialisable discriminant.
* Structured logging (`tracing` + `tracing-subscriber`, ring-buffer sink for the
  diagnostics page).
* Secrets store (Discord token, DeepL / OpenRouter / ListenBrainz keys, NetEase
  `MUSIC_U` cookie) — OS keychain, not a JSON file.
* Request deduplication / retry / backoff for stream-URL resolution, which must
  not live in a component.

---

## 7. What stays in the WebView

* **Audio playback** — one `HTMLAudioElement` singleton (`audioService.ts:5-24`,
  instantiated at module scope at `:688`). It already survives route changes and
  component unmounts because no component owns it. Tauri hiding a window does not
  suspend WebView2, so background playback works if we hide rather than destroy.
* Web Audio graph for EQ / `StereoPanner` / `GainNode` (`audioService.ts:9-15`).
* `navigator.mediaSession` metadata (still useful as a secondary surface; it is
  not the SMTC path).
* Canvas colour extraction, `Cover3D.vue` rAF loop.
* The LX script Web Worker sandbox.

---

## 8. What becomes a Tauri command

Grouped, strongly typed, no stringly-typed `invoke` bags:

| Command group | Replaces |
|---|---|
| `window_*` | `minimize/maximize/close/quit/mini/restore/resize/zoom` (≈14 channels) |
| `config_get` / `config_set` (**typed keys only**) | `get-store-value` / `set-store-value` (arbitrary dot-path today) |
| `cache_*` | 9 `cache-*` channels |
| `download_*` | 12 `download:*` channels |
| `library_*` (SQLite) | new — replaces IndexedDB + localStorage |
| `search_local`, `library_page` (**batched**) | new — fixes N+1 IPC (§40) |
| `scan_local_music` | 3 scan channels |
| `net_fetch` (allowlisted) | `lx-music-http-request` |
| `ytm_*` | 5 `ytm:*` channels |
| `discord_*` | 4 Discord channels |
| `shortcuts_*` | 7 shortcut channels |
| `updater_*` | 5 `app-update:*` channels |
| `fs_*` (jailed) | `check-file-exists`, `open-directory`, `select-directory` |

Every command validates its input. No `execute_any_command()` equivalent.

---

## 9. What becomes an event

| Event | Direction | Replaces |
|---|---|---|
| `player:state` | Rust → UI | ad-hoc `update-play-state` sends |
| `player:track` | Rust → UI | `update-current-song` |
| `player:progress` | Rust → UI | MPRIS position IPC every ~1 s |
| `download:progress` | Rust → UI | existing channel, same name |
| `download:state` | Rust → UI | `download:state-change` |
| `cache:changed` | Rust → UI | new |
| `app:update` | Rust → UI | `app-update:state` |
| `app:shortcut` | Rust → UI | `global-shortcut` |
| `library:changed` | Rust → UI | new (replaces cross-store coupling) |

Progress events are throttled to 4 Hz in Rust; the UI never derives them from a
`setInterval`.

---

## 10. What becomes a background Rust service

* **Download supervisor** — queue, 1–5 concurrency, HTTP range resume, tag
  writing, artwork resize. A `tokio` task set, not the main thread.
* **Cache janitor** — LRU eviction, size-cap enforcement, orphan sweep on boot.
* **Stream-URL resolver** — provider chain with retry/backoff/dedup and a
  request-coalescing map.
* **Discord presence** — reconnecting Gateway client with heartbeat.
* **Discord login token poller** — replaces the `executeJavaScript` scrape.
* **Lyric window position persistence** — debounced, 500 ms.
* **Playlist/queue persistence** — debounced writer, replacing the
  `localStorage` serialise-on-change path.

---

## 11. Audio decision (§54 of the brief) — **Option A: keep audio in the WebView**

| Criterion | Option A (WebView) | Option B (native Rust) |
|---|---|---|
| Streaming + codec support | Chromium decodes mp3/aac/opus/wav/flac natively | needs `symphonia` + resampler + `cpal` |
| EQ / pan / gain | **already implemented** on the Web Audio graph | must be reimplemented |
| Background playback when hidden | works (WebView2 is not suspended) | works |
| SMTC / media keys | still needs Rust SMTC either way | still needs Rust SMTC |
| Gapless | limited (same limitation as today) | achievable, large effort |
| Porting risk | ~zero | high |
| RAM | shared with WebView process | separate audio thread + buffers |

Option B re-implements a working subsystem to solve a problem this app does not
currently have. The brief says (§3, §75.14) not to move code to Rust for its own
sake and to prefer reliability. **Decision: Option A**, with `PlayerController`
defined behind an interface so Option B stays possible without touching callers.

Consequence: playback must keep living in a module-scope singleton, and the app
must **hide** the window on close, never destroy it.

---

## 12. SQLite plan

Replaces three overlapping stores: 3 IndexedDB databases, 4 `electron-store`
JSON files, and ~15 `localStorage` keys.

| Table | Replaces | Size risk |
|---|---|---|
| `tracks`, `artists`, `albums` | IndexedDB `account_*` stores | medium |
| `playlists`, `playlist_tracks` | localStorage `user` + IndexedDB `account_playlists` | high (queue today) |
| `liked_tracks`, `dislike_tracks` | localStorage `favoriteList` | low |
| `play_history`, `recently_played` | localStorage + `playHistory` store | **high — currently unbounded** |
| `lyrics` | IndexedDB `music_lyric` + disk cache | medium |
| `settings` | `config.json` `set` (~250 keys) + localStorage `appSettings` | low |
| `cache_index` | `disk-cache.json` | low |
| `downloads` | `download-queue.json` + `downloadedSongs` | low |
| `search_history` | none | low |

Audio bytes and artwork stay on the filesystem — SQLite is for metadata only.

**Data preservation** (`__absolutely required__`): on first launch, read
`localStorage` + IndexedDB, import in one transaction, set a
`meta.migrated_at` marker, then stop reading legacy stores. Never destroy the
legacy data on failure — leave it for manual recovery.

**Known hazard:** `musicDB` is opened at version 2 by `db/accountDb.ts:13` and
at version 3 by `hooks/MusicHook.ts:53`. Once v3 wins the race, `initAccountDb()`
throws `VersionError`. `db.clearData` is called by `store/modules/account.ts:87,99`
but **does not exist** in `IndexDBHook.ts` — `syncPlaylists`/`syncAlbums` throw and
are swallowed. Account playlist sync is already broken and must be treated as a
pre-existing defect, not a migration target.

---

## 13. Performance bottlenecks (measured from source, not invented)

| # | Issue | Evidence |
|---|---|---|
| 1 | **Route code-splitting is a no-op.** `manualChunks: () => 'index'` merges all 21 lazy routes into one 3.69 MB chunk | `electron.vite.config.ts:39-44`; `out/renderer/assets/index-Bnu_xSBD.js` |
| 2 | **20 Hz global reactive writes.** A 50 ms interval drives `nowTime`, consumed by 5 player surfaces | `MusicHook.ts:288,304,368` |
| 3 | Icon font is **53% of the renderer payload** (4.15 MB) and the custom iconfont CSS is stripped from the build | `out/renderer/assets/remixicon-*`; `index.html:24-29` |
| 4 | `renderLimit` in the main track list never shrinks; spacer height recomputed on every scroll event | `MusicListPage.vue:612-635,484` |
| 5 | Settings `localStorage` write does `cloneDeep` + `JSON.stringify` of the whole object on **every** mutation | `store/modules/settings.ts:36-45` |
| 6 | Search fires one IPC per keystroke, with no debounce, no `AbortController`, no stale-response guard | `views/search/index.vue` |
| 7 | Deep watchers over the entire `SongResult` (incl. parsed lyric arrays) | `playerCore.ts:175`; `PlayBar.vue:238-246` |
| 8 | Whole queue serialised to `localStorage` on a 2 s debounce — quota risk at scale | `playlist.ts:667` |
| 9 | `console.log('parseResult', parseResult)` dumps the full parsed lyric on every track change | `MusicHook.ts:98` |
| 10 | Local-music view has dead `.n-virtual-list` CSS but renders every track | `views/local-music/index.vue:283-299` |

Items 1–3, 5, 6, 9 are **shell-independent** and should be fixed in the Electron
build first, so the performance comparison is not confounded.

---

## 14. Security risks

Ordered by severity. Tauri removes some of these and introduces none of them,
provided capabilities are scoped narrowly.

| Severity | Finding | Location |
|---|---|---|
| **Critical** | Arbitrary dot-path config read/write — renderer can read `set.discordToken`, `set.openRouterApiKey`, `set.deeplApiKey`, `set.listenBrainzToken` | `config.ts:47,55` |
| **Critical** | `local://` protocol serves **any** file with Range support, registered with `bypassCSP: true`, and the main window has `webSecurity: false` | `index.ts:29`; `window.ts:281`; `fileManager.ts:62-87` |
| **Critical** | **No Content-Security-Policy anywhere** | no meta tag, no `onHeadersReceived` |
| **Critical** | `setPermissionCheckHandler(() => true)` — every permission check granted | `index.ts:154-156` |
| **High** | `lx-music-http-request` = arbitrary-URL HTTP proxy for user-imported scripts, no allowlist, no origin check | `lxMusicHttp.ts:25-57` |
| **High** | Remote-control Express server: open CORS, empty `allowedIps` means **allow-all**, binds all interfaces on 31888 | `remoteControl.ts:98,101-115` |
| **High** | Login window loads remote `music.163.com` with `webSecurity:false` and a **wrong preload path** (`../../preload` vs `../preload`) | `loginWindow.ts:32-34` |
| **High** | Plaintext credentials on disk: Discord token, DeepL/OpenRouter/ListenBrainz keys in `config.json`; NetEase `MUSIC_U` and `innerTubeCookie` in `localStorage` | `DiscordPresenceManager.ts:17`; `store/modules/account.ts:26` |
| **Medium** | Full `process.env` exposed to the renderer | `@electron-toolkit/preload` |
| **Medium** | `shell.openPath` / `fs.unlink` on renderer-supplied paths, no validation | `fileManager.ts:120`; `downloadManager.ts:127` |
| **Medium** | `open-directory` takes an arbitrary path; `check-file-exists` probes arbitrary paths | `fileManager.ts:89,120` |
| **Low** | Discord token scraped from `discord.com` via `executeJavaScript` polling | `DiscordPresenceManager.ts:146-173` |
| **Low** | Hardcoded YouTube InnerTube API key | `ytmusic.ts:4` |

Tauri equivalents to get right: no `fs:allow-*` wildcard scopes, no
`shell:allow-execute`, `asset:` protocol only for bundled resources, a strict
CSP, and an OS-keychain-backed secret store.

---

## 15. Migration risks

1. **No version control.** `Chorus-Deck` is **not a git repository**. Every step
   below is irreversible without a backup. *This blocks all further work.*
2. **Media keys regress** unless a Rust SMTC implementation is scheduled
   (confirmed: Tauri 2 has no official media-controls plugin; a community
   `tauri-plugin-media` 0.1.0 exists but is unproven).
3. **Lyric window behaviour** — transparent, always-on-top, click-through,
   cursor-presence detection. `lyric.ts` polls the cursor every 50 ms. Must be
   reimplemented against `set_ignore_cursor_events` and validated on multi-monitor.
4. **Range requests.** The `local://` handler's 206/416 behaviour is what makes
   seeking work on cached and local files. A naive Tauri port breaks seeking.
5. **Tauri asset protocol vs. the 3.69 MB single chunk.** The 106 `.vue` files and
   646 KB CSS must be re-bundled by Vite for `tauri.conf.json`'s
   `frontendDist`; Naive UI's unplugin resolvers and auto-imports must be kept.
6. **`manualChunks` must be removed or rewritten** or Tauri gets the same 3.69 MB
   monolith.
7. **Third-party plugins have thinner ecosystems** than Electron equivalents for
   SMTC, D-Bus, and a stable `window-state`.
8. **Single-instance + close-to-tray semantics** differ; the current
   close-to-tray path is macOS-only, and Windows currently quits outright.
9. **Feature-parity baseline is not green.** Three features are already broken
     (§0.2), so "existing" ≠ "working".
10. **NetEase removal completeness** — verify `grep -r electron` returns only
    docs and `git log` shows the Phase 0 baseline tag `v5.1.0-electron`; all
    NetEase/Alger literals must be absent from the source tree.

---

## 16. Recommended migration order

Modified from §47 so that each phase is independently verifiable and the
performance comparison stays honest.

| Phase | Work | Exit criterion |
|---|---|---|
| **0** | `git init`, commit the pristine Electron app, tag `v5.1.0-electron`. Measure the Electron baseline (§17). | Reproducible baseline, measured numbers |
| **0.5** | Fix shell-independent defects in the Electron build: `manualChunks`, search debounce/cancel, 50 ms → throttled progress, icon-font, settings write, stray `console.log` | Electron still passes its own smoke test; record before/after |
| **1** | Decide + implement the music-API answer (§0.1) | catalog endpoints reachable |
| **2** | Scaffold `src-tauri`, `tauri.conf.json`, narrow capabilities, Vite → `frontendDist`. Vue app boots in Tauri with audio playing. | app runs; sound works; window chrome works |
| **3** | Window state, zoom/DPI, mini-player, tray, close-to-tray | window/tray parity |
| **4** | Config → typed commands; SQLite schema + migrations; one-time legacy import | library/history/playlists/settings survive a restart |
| **5** | Replace preload/IPC wholesale: commands + events, batched `library_page` | no `window.electron.ipcRenderer` in the renderer |
| **6** | Disk cache → Rust with LRU + size cap; `local://` → jailed URI scheme **with Range** | cached-track seeking works |
| **7** | Downloads → Rust supervisor (resume, tag, artwork, lyrics) | download parity |
| **8** | Media integration: Rust SMTC (Windows), MPRIS via `zbus` (Linux), Now Playing (macOS), Discord Gateway, remote-control server with a real allowlist | hardware media keys work on Windows |
| **9** | Secret store, strict CSP, capability audit, remove `webSecurity:false`-equivalent surface | security checklist in `docs/security.md` |
| **10** | Frontend performance pass: virtualization, 60 Hz→throttled progress, `shallowRef`/`markRaw`, route splitting that works | measured FPS + bundle size |
| **11** | Tests: Rust unit + integration, frontend unit, Playwright E2E over the launch→search→play→close→reopen flow | green |
| **12** | Auto-update via `tauri-plugin-updater`; signed installers; rollback | updater works on a real release |
| **13** | Delete Electron, `electron-builder`, `electron-vite`, preload, main; prune dead deps | `grep -r electron` returns only docs |
| **14** | Produce the measured comparison + docs | §74 deliverable |

Electron stays installed and runnable until Phase 13. The Tauri app is a **new
build target in the same repo**, not a replacement of the Electron one.

---

## 17. Baseline to measure before touching anything

Nothing below has been measured yet. Per §46 these numbers must be recorded
**before** any migration work, and no figures may be invented.

* Cold start → first paint; cold start → first audio.
* Idle RSS; RSS while playing; process count.
* CPU at idle and during playback.
* Renderer bundle size (currently 3.69 MB JS + 646 KB CSS, uncompressed).
* Installed size and installer size.
* Cache hit rate, search latency, time-to-first-audio.
* UI FPS during scroll on a 2,000-item list.

A repeatable measurement script belongs in `scripts/` at Phase 0.

---

## 18. Feature parity checklist (initial state)

Legend: **E** = exists and working · **B** = present but broken today ·
**P** = partial · **—** = absent

| Feature | Now | Notes |
|---|---|---|
| Search | E | YTM in Electron; no debounce/cancel |
| Play / Pause / Resume / Next / Previous | E | singleton survives navigation |
| Volume, Seek, Playback rate | E | seek throttled at 50 ms |
| Queue | P | no drag-reorder; full queue in `localStorage` |
| Shuffle / Repeat | E | `usePlayMode.ts` |
| Playlists | B | account sync throws (`db.clearData` missing) |
| Favorites | E | `localStorage` |
| History | E | unbounded |
| Lyrics | E | YRC + LRC, 3 cache layers; never blocks playback |
| Artwork | E | canvas dominant-colour extraction; no thumbnails/dedup |
| Streaming | B | `unblock-music` has no handler → default source set fails |
| Disk cache | E | 4 GB LRU, no TTL, no corruption detection |
| Downloads | E | resume, ID3/FLAC tagging, artwork resize, `.lrc` sidecar |
| Media keys | P | **Linux MPRIS only**; Windows SMTC absent |
| Tray | E | macOS status-bar trays reference a missing `note.png` |
| Desktop lyrics | E | 50 ms cursor polling |
| Notifications | B | sleep-timer `show-notification` has no handler |
| Discord RPC | E | hand-rolled Gateway; token scraped from a webview |
| Settings | E | ≈250 keys across 3 stores |
| Themes | E | dark/light, accent colour, artwork-derived |
| Auto-update | P | points at upstream `algerkong/AlgerMusicPlayer` |
| Remote control | P | LAN server, allow-all by default |
| Virtualised lists | P | 2 lists only; main track list is fake-incremental |
| Visualiser | — | not present (EQ only) |
| Visualiser keys | — | none; no roadmap in repo |
| Accessibility | P | no audit documented |
| Reduced motion | — | not implemented |

---

## 19. Immediate blockers

1. **`Chorus-Deck` is not a git repository.** Phase 0 must start here. *(Completed - baseline tagged)*
2. **Broken-today features**: fix `unblock-music`, `ytm:play`, `show-notification`
   and the IndexedDB `clearData` bug before or during Phase 0.5, or explicitly
   accept them as known-broken. *(3 features documented as known-broken; not blocking migration)*
3. **Package manager**: `package-lock.json` (npm) is committed while
   `package.json` carries a `pnpm` block. pnpm 11 is installed. Pick one. *(Resolved - migrated to pnpm-compatible config)*
