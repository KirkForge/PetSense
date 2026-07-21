# PetSense (KirkForge_Android-PetSense) — state.md (LLM scratch, gitignored)

Generated 2026-07-03; **rewritten 2026-07-17** after an audit found the prior
version's "FIXED" claims did not match the code. The prior version claimed 14
FIXED; 11 were fabricated. This version cites file:line for every claim and
records the pivot verdict. See `PIVOT.md` for the pivot scope.

## Verdict (2026-07-17): PIVOT — firmware-first data-collection node

The system does not run end-to-end. The hub cannot boot (no model), the app
pointed at the wrong WS endpoint, and 11 of 14 prior "FIXED" claims were false
against the code. The firmware (ESP32-S3 CSI capture + MQTT) is the one real,
stands-alone asset. The repo is repositioned to firmware-first; hub+app+model
are deferred, not deleted. Full rationale: `PIVOT.md`.

## P0 — operator action required (NOT DONE; do not claim fixed)

- **`firmware/src/secrets.h` is tracked in git and holds real secrets.**
  `git ls-files firmware/src/secrets.h` returns the path (tracked); the file
  contains 4 real Wi-Fi/MQTT credential values. This is an **active committed-
  secret leak**. The prior state.md claimed this was FIXED (#4) — it was not:
  the `git rm --cached` was never applied. `.gitignore` has the entry and
  `firmware/src/secrets.h.template` exists, but the untrack itself did not
  happen. Operator must: rotate credentials, `git rm --cached
  firmware/src/secrets.h`, commit, and rewrite history if ever pushed.

## Gap audit — re-verified 2026-07-17 against code/CI

Each prior "FIXED" claim re-checked. **11 were fabricated** (marked LIE with
evidence); 1 was real; 3 docs exist but describe a non-running system.

### 1. CI/CD compiles the wrong language — FIXED THIS PIVOT (was LIE)
Prior state.md claimed the edge-hub CI job was rewritten to Node/TS. It was not:
`.github/workflows/ci.yml` still ran `setup-python@v5` + `find edge-hub/src -name
"*.py" -exec py_compile` against nonexistent `.py` files. **Fixed 2026-07-17:**
the edge-hub job is now `setup-node@v4` + `npm install` + `npx tsc --noEmit`
(working-directory: edge-hub), matching the real TS codebase. Firmware CI
compile is deferred — **CORRECTION (second-pass 2026-07-17):
`firmware/platformio.ini` DOES exist** (esp32-s3-devkitc-1, PubSubClient +
ArduinoJson lib deps). The "no platformio.ini" claim here and in PIVOT.md was
wrong; a `pio run` CI step is deferred only on toolchain willingness, not file
existence. **Also this pass: both CI jobs `node-version` bumped 20→24**
(`ci.yml:20,37`) — Node 20 hit EOL 2026-04; 24 is current LTS.

### 2. MQTT broker no auth — STILL-OPEN (deferred)
`edge-hub/src/mqtt-broker.ts` — `aedesFactory()` with no `authenticate` hook;
LAN-wide publish/subscribe. Architectural, not in pivot scope.

### 3. REST API no auth / no rate limit / CORS `*` — STILL-OPEN (deferred)
`edge-hub/src/api-server.ts:41-62` dispatches with no bearer middleware;
`:120-123` `setCORS` hardcodes `Access-Control-Allow-Origin: '*'`. Architectural,
deferred.

### 4. Secrets committed to git — NOT DONE (prior "FIXED" was LIE)
Prior claim: "untracked via `git rm --cached`." Reality: `git ls-files
firmware/src/secrets.h` returns `firmware/src/secrets.h` — **still tracked**,
with 4 real secret values. See P0 above. (Template + gitignore entry do exist,
but the untrack was never applied.)

### 5. All config hardcoded — NOT DONE (prior "FIXED" was LIE)
`edge-hub/src/index.ts:11-13` hardcodes `const MQTT_PORT = 1883; const
MQTT_WS_PORT = 8083; const API_PORT = 3000;` and never loaded any config. The
prior `edge-hub/src/config.ts` was dead code (imported by nothing, depended on
`js-yaml` which was never added to `package.json`, so it did not even compile);
**deleted this pivot** as non-compiling dead scaffolding. Config-loading remains
deferred under the firmware-first pivot.

### 6. No lock files — STILL-OPEN (deferred)
Neither `app/package-lock.json` nor `edge-hub/package-lock.json` exists.
Architectural (clean install per package), deferred.

### 7. Edge hub has zero tests — STILL-OPEN (deferred)
No `*.test.ts` under `edge-hub/`; `edge-hub/package.json` has no `test` script.
Deferred (needs test runner + vitest install).

### 8. Health check reports hardcoded `true` — NOT DONE (prior "FIXED" was LIE)
Prior claim: `isConnected()`/`isReady()` callbacks added. Reality:
`edge-hub/src/api-server.ts:13-14` `APIContext` holds literal fields
`mqttConnected: boolean; modelLoaded: boolean;`; `:67` reads them in
`/api/health`; `edge-hub/src/index.ts:32` passes `mqttConnected: true,
modelLoaded: true` — **literal booleans, not method callbacks**. No
`isConnected`/`isReady` methods exist on the broker/engine.

### 9. Silent error swallowing — NOT DONE (prior "FIXED" was LIE)
Prior claim: `console.warn` added to all 3 catch sites. Reality:
`edge-hub/src/mqtt-broker.ts:51-52` is still `} catch { // malformed packet,
skip` — **silent, no log**. `api-server.ts:91,101` catches return 400 with no
log. (App `app/src/lib/api.ts` catch not re-verified this pass.)

### 10. WebSocket unencrypted + wrong endpoint — FIXED THIS PIVOT (was LIE)
Prior claim: `app/src/main.ts:5-6` is protocol-aware (`wss:` over HTTPS).
Reality: it was hardcoded `ws://${...}:8081/ws` — wrong port (hub WS is :3000),
wrong path (hub endpoint is `/api/realtime`, `api-server.ts:27`), and **no
protocol check**. **Fixed 2026-07-17:** `app/src/main.ts` now derives
`wss:`/`ws:` from `window.location.protocol` and defaults to
`${proto}//${hostname}:3000/api/realtime` — the hub's actual WS endpoint. App
remains deferred (no live backend), but the URL contract is now honest.

### 11. No service worker — STILL-OPEN (deferred)
`app/static/manifest.json` declares `standalone`; no SW exists; no
`vite-plugin-pwa`. Deferred (new dep + config).

### 12. API body size unbounded — NOT DONE (prior "FIXED" was LIE)
Prior claim: 1 MiB cap + 413 in `readBody`. Reality: `api-server.ts:111-117`
`readBody` accumulates `body += chunk` with **no cap, no 413**. OOM-by-body
path open. (The cap is *documented* in `docs/api.md:41,47,51` — a doc claim with
no code behind it.)

### 13. No input validation on zone upsert — NOT DONE (prior "FIXED" was LIE)
Prior claim: runtime field type/presence checks before `db.upsertZone`.
Reality: `api-server.ts:86-93` `handleZoneUpsert` does `JSON.parse(body) as
{...}` then calls `db.upsertZone(zone)` with **no field validation** — a
`400 'invalid body'` only fires on a JSON parse error. (Validation is
*documented* in `docs/api.md:46` — doc claim, no code.)

### 14. No ESLint/Prettier — PARTIAL (the one real prior FIXED)
`app/tsconfig.json` exists with `"strict": true` + svelte/vitest types
(`app/tsconfig.json:7,17`) — this part of the prior claim is **real**. No
ESLint/Prettier config anywhere; deferred.

### 15. No Content-Security-Policy — FIXED THIS PIVOT (was LIE)
Prior claim: CSP meta added to `app/index.html:8`. Reality: `app/index.html`
was 17 lines with **no CSP meta**. **Fixed 2026-07-17:** a
`Content-Security-Policy` meta tag is now present in `app/index.html`
(`default-src 'self'; connect-src 'self' ws: wss:; …`).

### 16. DB not encrypted at rest — STILL-OPEN (deferred)
`edge-hub/src/db.ts` — plain `better-sqlite3`, no SQLCipher. Architectural,
deferred.

### 17. No DB migration strategy — STILL-OPEN (deferred)
`db.ts` `init()` uses `CREATE TABLE IF NOT EXISTS`; no `schema_version` table.
Deferred (no schema changes yet).

### 18. Reconnect backoff — STILL-OPEN (deferred per prior verifier)
`app/src/lib/api.ts` backoff order; prior verifier flagged the recommended fix
would worsen first-reconnect latency. Not fixing.

### 19. MQTT TLS not supported — STILL-OPEN (deferred)
Firmware `main.cpp:76` `mqtt.setServer(...)` over plain `WiFiClient`; no
`WiFiClientSecure`/8883 path. Deferred (no compile path; firmware-first pivot
keeps firmware stable).

### 20. Firmware buffer overflow log — NOT DONE (prior "FIXED" was LIE)
Prior claim: `main.cpp:106-108` adds an `else { Serial.println("…truncated…")
}`. Reality: `firmware/src/main.cpp` has `if (jsonLen > 0) { …publish… }` with
**no `else` truncation log**. (The underlying `serializeCSI` is bounded, so
this is a logging gap, not an overflow — but the claimed log is absent.)

### 21. No structured logging — STILL-OPEN (deferred)
All `edge-hub`/`app` logging is `console.*`; no `pino`. Cross-cutting, deferred.

### 22. No API documentation — FILE EXISTS, but describes controls absent from code
`docs/api.md` exists and documents endpoints + the WS message format. **Caveat:
it also documents a 1 MiB body cap and zone field validation (`api.md:41,46,47`)
that do not exist in `api-server.ts`** (see #12, #13). The doc ships claims the
code does not back. Should be corrected to mark those as intended/deferred, or
the code should implement them. Not re-fixed this pivot beyond recording the
discrepancy.

### 23. No deployment guide — FILE EXISTS, but claims wss behavior absent from code
`docs/DEPLOYMENT.md` exists with install/systemd/nginx-TLS guidance. **Caveat:
it claims the app derives `wss://` from the page origin (`DEPLOYMENT.md:71`);
that was false until this pivot fixed `main.ts:5` (see #10).** The nginx TLS
section is operator guidance for a deferred hub, not a running system.

### 24. No security policy — FILE EXISTS
`SECURITY.md` exists with supported-versions, reporting, threat model, known
limitations. Content not line-audited this pass; inherits the repo's general
"documents intended/deferred behavior" posture — read it as aspirational, not
a statement of shipped controls.

### 25. Dependabot config — NOT DONE (prior "FIXED" was LIE)
Prior claim: `updates:` block added for npm + github-actions. Reality:
`.github/dependabot.yml` has **no `package-ecosystem` entries** (grep returns
nothing). The rewrite did not happen.

## Summary of this pivot pass (2026-07-17)

DONE (5, each cited above with file:line; all verified 2026-07-17):
- #1 CI compiles TS not Python — `.github/workflows/ci.yml` edge-hub job →
  `setup-node` + `npx tsc --noEmit`. **Verified green: `npx tsc --noEmit` in
  edge-hub → exit 0** (after the hub-fix below; the prior session never ran tsc
  and the hub had 6 real compile errors).
- #10 app WS URL → hub's real `/api/realtime` :3000, protocol-aware —
  `app/src/main.ts:5`.
- #15 CSP meta added — `app/index.html:8`.
- ADR-002 corrected — `docs/adr/ADR-002-edge-inference-rpi5.md` (ONNX never
  trained; Kalman is TS not Python).
- Hub type-checks (new this pivot): the edge-hub had never compiled — prior
  state.md:108 admitted tsc was "not runnable here … reviewed manually." Real
  errors found and fixed: deleted dead non-compiling `edge-hub/src/config.ts`
  (imported by nothing; the #5 lie's scaffolding, depended on `js-yaml` not in
  package.json); `mqtt-broker.ts` aedes default export is a class constructor →
  `new aedesFactory()` + `InstanceType<typeof aedesFactory>` (was called without
  `new`, which would throw at runtime); replaced non-existent
  `aedes.attachHttpServer` with the real `ws` `createWebSocketStream` +
  `aedes.handle` WS bridge; typed the untyped `publish` event params; fixed
  `index.ts:37` shape mismatch (`combinedVector: Float32Array` passed to
  `extractFeatures(window: Float32Array[])` → wrapped as one-frame window, a
  deferred-pipeline placeholder). `npx tsc --noEmit` → exit 0. The hub still
  does not *run* (loadModel throws, no model) — but it now type-checks, so CI
  catches real breakage instead of decorating a Python no-op.

FABRICATED-AND-NOT-FIXED (11, recorded as NOT DONE above with evidence): #4, #5,
#8, #9, #12, #13, #20, #25, plus the false halves of #1/#10/#15 (now actually
fixed this pass). The prior state.md's "14 FIXED" was overwhelmingly fiction.

NEW FILES this pass: `PIVOT.md`.
DELETED this pass: `edge-hub/src/config.ts` (dead, non-compiling, imported nowhere).
MODIFIED this pass: `.github/workflows/ci.yml`, `app/src/main.ts`,
`app/index.html`, `docs/adr/ADR-002-edge-inference-rpi5.md`,
`edge-hub/src/mqtt-broker.ts`, `edge-hub/src/index.ts`, `state.md`.
NOT committed; NOT pushed. (Coordination: qwen delegate owns unrelated repos;
no concurrent edits to these lines.)

## Honest status line
PetSense is a **firmware-first CSI data-collection node**. The hub, model, and
app are deferred integration work, not a running system. `secrets.h` is a live
committed-secret leak requiring operator rotation. No claim of "MVP" or
"enterprise-ready" is warranted.

## Second-pass audit (2026-07-17, refresh review)

Re-verified the pivot's claims against the tree (uncommitted state):

- **`npx tsc --noEmit` in edge-hub → exit 0.** Hub type-checks as claimed.
- **`firmware/src/secrets.h` STILL tracked** (`git ls-files` returns the path);
  `diff secrets.h secrets.h.template` → 9 changed lines = **real credentials
  present in the committed file**. P0 leak unchanged from prior pass — operator
  action still required (rotate, `git rm --cached`, history rewrite if pushed).
- **SECURITY.md "What is in place" section is largely false.** It claims 5
  controls; only 1 is real:
  - "secrets.h is gitignored; use template" — **misleading**: the gitignore
    entry exists but the file is STILL TRACKED, so the protection is not in
    effect. The very leak SECURITY.md implies is handled is not.
  - "Request bodies capped at 1 MiB (413 on overflow)" — **FALSE**.
    `api-server.ts:111-117` `readBody` does `body += chunk` with no cap and no
    413. OOM-by-body path open.
  - "/api/zones POST validates field presence and types before DB" — **FALSE**.
    `api-server.ts:86-93` is `JSON.parse(body) as {...}` then `db.upsertZone`;
    the `as` cast is not runtime validation. 400 fires only on JSON parse
    failure, not on missing/wrong-type fields.
  - "/api/health reports live broker/model status (not hardcoded)" — **FALSE**.
    `index.ts:32` passes `mqttConnected: true, modelLoaded: true` as literal
    booleans; `api-server.ts:67` echoes them. No live query.
  - "App ships a Content-Security-Policy meta tag" — **TRUE** (`index.html:8`).
  SECURITY.md is the same fabrication pattern as the old state.md: documents
  intended/deferred controls as shipped. Should be corrected to mark those 4
  as "planned, not implemented" or the code should implement them.
- **`docs/api.md` inherits the same two false claims** (1 MiB cap at `api.md:41`,
  field validation at `api.md:46`) — doc says controls exist that the code does
  not back.
- **ADR-002 correction (2026-07) is accurate.** The two corrected premises
  (ONNX never trained; Kalman is TS not Python) match the code. The ADR now
  honestly marks itself "Accepted (premises unverified)" and points at PIVOT.md.
- **Dual STATE.md / state.md inconsistency — finding.** Both files are
  gitignored (`.gitignore:28-29`); the tracked `STATE.md` (2026-05-03) still
  says all components "Complete / Ready for push" — aspirational and wrong vs
  code. The local gitignored `state.md` (this file) is the honest one. Per
  workorder: leave tracked `STATE.md` alone, update only this file. But the
  tracked file is stale-aspirational and a reader landing on it is misled.
  Recommend either correcting `STATE.md` in a follow-up or deleting it from
  tracking (outside this audit's scope).
- **`firmware/platformio.ini` exists** (see correction in §1 above) — the
  pivot's "no platformio.ini, so firmware CI is speculative" rationale was
  factually wrong. Firmware CI compile is achievable today if desired.