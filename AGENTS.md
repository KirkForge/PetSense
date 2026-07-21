# AGENTS.md — Worker Contract for KirkForge_Android-PetSense

*This file is the verifier contract for any AI agent working in this repo. Read it before starting. Follow it always. Violations are regressions.*

**See also**: [REPORULES.md](../REPORULES.md) — multi-machine sync, git identity, PAT handling, and new-repo bootstrap.
**See also**: [SPEC.md](SPEC.md), [PIVOT.md](PIVOT.md), [SECURITY.md](SECURITY.md), [docs/](docs/), [docs/adr/](docs/adr/) — architecture, threat model, ADRs.

## 0. Repo-specific guidance (existing — keep)

**⚠️ Mandatory Rules — Read Before Editing**

- **Never commit**: `node_modules/`, `.venv/`, `venv/`, `__pycache__/`, `*.pyc`, `dist/`, `build/`, `.next/`, `coverage/`, `.mypy_cache/`, `.pytest_cache/`, `.ruff_cache/`, `.tox/`, `.DS_Store`, `*.log`, `.env`, `*.pem`, `*.key`
- **Always pull before work, push after work**
- **Git identity**: `Henrik Kirk <285947470+KirkForge@users.noreply.github.com>`
- **Commit format**: `type(scope): message` — feat, fix, docs, refactor, test, chore, wip
- **Pre-push CI**: `ci-cleandev` hooks block pushes on failure. Fix, don't bypass.

**Project Rules**
- Keep files minimal and clean
- Don't add generated or dependency files

**Before Editing**
1. `git pull`
2. Check `.gitignore` — don't stage ignored files
3. Check this file for project-specific rules

**Before Committing**
1. `git status --short` — review staged files
2. No secrets, no generated files, no cache directories
3. `git diff --cached` — verify actual content
4. Let pre-push CI pass before pushing

**Stack**: PetSense — track dogs/cats through walls using commodity WiFi Channel State Information (CSI). No cameras, no wearables, no cloud. Three components:
- `firmware/` — ESP32-S3 CSI capture + MQTT publish (PlatformIO, Arduino framework, `PubSubClient` + `ArduinoJson`).
- `edge-hub/` — RPi5 aggregation + ONNX inference + Kalman tracker + API (Node.js, TypeScript, `aedes` MQTT broker, `better-sqlite3`, `onnxruntime-node`, `ws`, `vitest`).
- `app/` — Svelte 5 PWA live map + timeline + alerts + health (Vite, `vitest`, `@testing-library/svelte`, jsdom).
- `models/` — CNN training + ONNX export + synthetic data generation.

**Secrets convention**: `firmware/src/secrets.h` is gitignored (user-filled per-node). Only `secrets.h.template` is tracked. A careless `git add` must not ship real secrets.

## 1. Plan mode default
- Before writing any code, write a plan to `workplan.md` (gitignored). The plan must list the files you will touch (full paths), state the root cause you're fixing (not the symptom), and state the gate you'll run to verify.
- Check `workplan.md` before implementation. Check `lessons.md` for lessons from prior sessions. Check `state.md` / `STATE.md` for current repo state. (This repo has both `state.md` and `STATE.md` — see which is tracked; `STATE.md` is the tracked one, `state.md` is gitignored per the old convention but now un-ignored per this contract.)
- If the task is unclear, say so in `workplan.md` and escalate — do not guess.

## 2. Subagent strategy
- For complex multi-step tasks, break them into subtasks and dispatch subagents.
- Each subtask must have a clear scope (files to touch), a gate (command to run), and a done-condition.
- Do not dispatch a subagent for a task you can do in <5 minutes yourself.

## 3. Self-improving loop
- At session end, write `lessons.md` (gitignored) with: what you learned about this codebase (conventions, gotchas, patterns), what you tried that didn't work and why, what you'd do differently next time.
- Update `STATE.md` (tracked) with: what changed this session, what's pending, what's blocked.
- Lessons from `lessons.md` that are permanent conventions get folded into this `AGENTS.md` file — so the next worker reads them automatically.

## 4. Verification
- Run the gates before every commit. Paste the actual output (not paraphrased). A green claim requires the pasted output + the head SHA. "It passed" is not evidence.
- Gates for this repo (multi-component — run the one(s) matching the files you touched):
  - **edge-hub/** Test: `cd edge-hub && npm test`  (vitest run)
  - **edge-hub/** Typecheck: `cd edge-hub && npx tsc --noEmit`  (tsconfig `strict: true`, `rootDir: src`)
  - **app/** Test: `cd app && npm test`  (vitest run, jsdom)
  - **firmware/** Build: `cd firmware && pio run`  (PlatformIO, `env:esp32-s3`)
  - Lint: n/a (no dedicated lint script in edge-hub or app package.json)
  - Fmt: n/a (no dedicated fmt script; prettier not configured)
- Do not rewrite tests to make them pass. Fix the root cause.
- Do not add `|| true`, `|| echo "non-fatal"`, `.skip(`, `xtest`, `it.skip` to make red go green.

## 5. Demand elegance
- Small, pure, well-named functions. No dead code. No debug spam (`console.log`, `print(`, `debugger`, `alert`, `Serial.println` left in committed firmware beyond intentional diagnostic output) in committed code.
- Match the existing style: TypeScript strict in `edge-hub/` (`target: ES2022`, `module: ESNext`), Svelte 5 runes in `app/`, Arduino C++ in `firmware/`.
- Preserve honest-doc annotations — this repo uses `ponytail:` (e.g. `edge-hub/src/mqtt-broker.ts:11` documents aedes default-export shape; `:57` documents aedes typed event map omissions; `:91` documents aedes 0.50 missing `attachHttpServer`; `app/tests/views/*.test.ts` document vitest cross-file state-leakage mitigations; `app/vitest.config.ts:11` documents Svelte 5 client build in jsdom; `.github/workflows/ci.yml:38` documents the missing npm cache gap). They document known limitations and library-version pins. Removing them is a regression. The `.gitignore:64` `ponytail:` on `secrets.h` is a security pin — keep it.
- A change that adds 100 lines to fix a 3-line bug is probably wrong. Find the smaller change.

## 6. Autonomous bug fixing
- If a test fails, read the error. Find the root cause. Fix it.
- Do NOT: rewrite the test to pass, add `|| true`, lower a threshold, delete the assertion, add `.skip(` / `xtest` / `it.skip` to make red go green.
- Do NOT: add debug logging to committed code. Use `workplan.md` for scratch notes.
- If you've attempted the same fix 3 times and it's still red, STOP. Write "ESCALATE: <root cause unknown>" in `lessons.md` and return. The brain takes over when the brawn is stuck.

## Task management
1. **Plan**: write `workplan.md` (gitignored) with files to touch + root cause + gate.
2. **Check before implementation**: read `workplan.md`, `lessons.md`, `STATE.md`, and this `AGENTS.md`.
3. **Check progression**: after each file edit, verify it compiles/lints/typechecks. Don't batch 10 changes then discover the 3rd was wrong.
4. **Explain changes**: post a summary in `workplan.md` (what changed, why) and a one-liner in `CHANGELOG.md` (if it exists — this repo has none, so skip).
5. **Session close**: commit → write `lessons.md` (what I learned) → update `STATE.md` (what changed, what's pending) → `CHANGELOG.md` one-liner (if it exists) → verify clean tree → verify gates green → paste final gate output. Session is NOT done until all 6 are done.
6. **Worktree discipline**: work in an isolated worktree off `origin/main` (this repo's default branch). `git fetch && git reset --hard origin/main` before starting. Never touch `main` directly. Never force-push. Fix forward.
7. **Scope discipline**: touch only the files the task names. If you need to edit outside scope, note it in `lessons.md` as "scope creep: <file> because <reason>".
8. **Honesty over claim**: paste gate output, never say "green" without the run ID + head SHA. An ADR that overclaims is a regression. A "CI green" citation for the wrong run ID is a regression.

---

## 🔒 Secure-Defaults Checklist (Definition of Done)

> **The rule:** The secure state is the DEFAULT. Opening it up is an EXPLICIT, LOGGED, opt-in — never the fallback.

### Network binding
- [ ] Servers bind `127.0.0.1` by default. Non-loopback requires explicit flag/env AND auth enabled.
- [ ] Non-loopback bind logs a startup WARNING naming the exposure.
- [ ] CORS / allowed-hosts default to an explicit allowlist, never `["*"]`.

### Secrets
- [ ] No secret has a usable default value. Missing secret in production → refuse to boot (`exit 1`).
- [ ] Empty-string / placeholder secrets are never a valid signing key, even in dev. Generate random per-process secret if none supplied (+ warning).
- [ ] No secret value is written into generated artifacts (systemd units, configmaps, scripts).
- [x] Secrets come from env or a secret manager — never a committed file. `firmware/src/secrets.h` is gitignored (only `secrets.h.template` tracked). `*token*.json`, `credentials*.json` etc. are gitignored.

### Comparisons (constant-time)
- [ ] Every secret / token / signature / hash comparison uses constant-time compare (`hmac.compare_digest` / `crypto.timingSafeEqual`), never `==` / `!==`.
- [ ] `grep -rEn '(sig|hmac|token|secret|hash|key)\b.*(==|!=|!==)' src/` returns nothing that compares a secret.

### Allowlists / deny-by-default
- [ ] An empty allowlist means DENY, never ALLOW-ALL.
- [ ] Filesystem paths from tool/API input are confined to a configured root by default; arbitrary paths require explicit opt-in.
- [ ] Command execution uses argv arrays, never `shell=True` / string interpolation. Raw-shell paths gated behind `ALLOW_UNSAFE_*=1`, default off.

### Multi-tenant isolation
- [ ] Every shared store (sessions, cache, files, memory, routing) is keyed by `tenant_id`, not a global namespace.
- [ ] List/enumerate endpoints scope results to the calling tenant.
- [ ] Identity (owner/role/tenant) is derived from the authenticated session/token, never from the request body.
- [ ] At least one test asserts tenant A cannot read/modify tenant B's data.

### Authorization (not just authentication)
- [ ] Every protected endpoint calls BOTH authn (who are you) AND authz (are you allowed).
- [ ] New endpoints are deny-by-default — added to the authz table, not left to fall through.

### Sandbox / untrusted execution
- [ ] Child processes get an explicit env allowlist, not `{...process.env}` inheritance.
- [ ] For untrusted/model-generated code, real isolation (container/microVM/namespaces + rlimits + no-new-privs) is the DEFAULT path; bare-host "constrained" is opt-in with a warning.
- [ ] Isolation claims in README match what the code enforces. No "kernel-enforced"/"enterprise-grade" unless it is.

### Claims vs reality
- [ ] README maturity label matches code reality.
- [ ] Threat model is documented for anything that takes untrusted input. (See `SECURITY.md`.)
- [ ] No dead code that implies a capability the product doesn't have.

## Escalation
If you are stuck after 3 attempts, say so. Write "ESCALATE: <root cause unknown>" in `lessons.md`. The brain (frontier model) takes over. This is not a failure — it's the design: the Fiat knows when to call the tow truck.