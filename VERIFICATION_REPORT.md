# Class1Dev MCP Server: Final Verification & Traceability Report

> **Project:** Class1Dev Model Context Protocol Server  
> **Scope:** Local Implementation with Real Class1 Takeoff Cost-Risk Engine & Neon PostgreSQL  
> **Evaluation Date:** November 13, 2026  
> **Status:** GAP AUDIT COMPLETE — VERIFIED LOCAL IMPLEMENTATION WITH DOCUMENTED LIMITATIONS

---

## 1. Master Requirements Traceability & Verification Table (Phases 0–6)

Every requirement from the original Phase 0–6 engineering specification, PRD, and mentor constraints is mapped below to concrete evidence, file paths, and live command outputs. Items lacking direct local execution proof are honestly classified as **NOT VERIFIED**.

| Phase | PRD / Prompt Requirement | Status | Concrete Evidence / File Path / Command Output |
| :--- | :--- | :---: | :--- |
| **P0** | Architectural audit of starter & PRD | **PASS** | Completed Phase 0 audit; verified `@nitrostack/core`, Neon, Drizzle, Zod, and Vitest. |
| **P0** | No code changes during audit phase | **PASS** | Zero file modifications occurred during Phase 0 turn. |
| **P0** | Mask all secrets in output | **PASS** | Verified `DATABASE_URL` and `AUTH_SECRET` masked across logs, errors, and scripts; [src/utils/error-handler.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/utils/error-handler.ts). |
| **P1** | Generate strong 32-byte `AUTH_SECRET` | **PASS** | Generated 32-byte hex secret written to `.env`; validated by [src/config.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/config.ts). |
| **P1** | Run `npm install` cleanly | **PASS** | All dependencies installed locally via `npm install`. |
| **P1** | Document dependency audit | **PASS** | `npm audit` captured: 16 vulnerabilities (11 moderate, 3 high, 2 critical) in third-party packages. |
| **P1** | Run `npm run db:migrate` against Neon | **PASS** | Applied DDL creating `users`, `records`, and `audit_logs` in live Neon PostgreSQL instance. |
| **P1** | Run `npm run db:seed` against Neon | **PASS** | Populated default user (`...0001`) and 2 baseline PR cost evaluation records. |
| **P1** | Verify `users`, `records`, `audit_logs` exist | **PASS** | Verified via live SQL query on `information_schema.tables`. |
| **P1** | Verify seed idempotency (run twice) | **PASS** | Ran `npm run db:seed` twice; record counts remained identical (Users: 1, Records: 2, Audit: 137). |
| **P2** | Constant-time Bearer token verification | **PASS** | [src/middleware/auth.middleware.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/middleware/auth.middleware.ts); `crypto.timingSafeEqual` over SHA-256 digests. |
| **P2** | In-memory rate limiting with `/health` exempt | **PASS** | [src/middleware/rate-limit.middleware.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/middleware/rate-limit.middleware.ts); `/mcp` returns 429 after burst; `/health` returns 200. |
| **P2** | Global error boundary preventing leakage | **PASS** | [src/middleware/error.middleware.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/middleware/error.middleware.ts) & [src/utils/error-handler.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/utils/error-handler.ts). |
| **P2** | Payload size cap returning clean HTTP 413 | **PASS** | Payloads > 1 MB return HTTP 413 `Payload Too Large` clean JSON ([scripts/test_edge_cases.mjs](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/scripts/test_edge_cases.mjs) Case 7). |
| **P2** | Parameterized SQL queries (no string concat) | **PASS** | All queries use Drizzle ORM parameterized SQL or `$1, $2` parameters via `@neondatabase/serverless`. |
| **P3a**| Inspect `class1==0.1.0` sdist from PyPI | **PASS** | Inspected sdist tarball; discovered upstream packaging omission of `cost_engine/footprint.py`. |
| **P3a**| Zero edits inside Python `site-packages` | **PASS** | Clean `.venv` (Python 3.14.6); zero files modified or created in `Lib/site-packages`. |
| **P3b**| Repository wrapper with footprint placeholder | **PASS** | [python/run_class1.py](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/python/run_class1.py) covers all 14 names; raises `NotImplementedError` or returns disclaimer. |
| **P3b**| Zero synthetic or invented footprint numbers | **PASS** | Carbon/water/materials stripped; reports `"Ecological footprint: NOT COMPUTED"`. |
| **P3b**| Prove core cost math is unaffected | **PASS** | Grepped sdist; core cost engine modules do not import footprint; 430 upstream tests pass. |
| **P3c**| Child process execution safeguards | **PASS** | [src/services/class1-engine.service.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/services/class1-engine.service.ts); argument array, `PYTHONUTF8=1`, 30s timeout, concurrency cap 2, temp cleanup. |
| **P3c**| Three-state verdict evaluation logic | **PASS** | P90 > budget $\to$ `BLOCK`; P90 $\ge 0.8 \times$ budget $\to$ `WARN`; else `PASS`; no budget $\to$ `NO_BUDGET`. |
| **P3c**| Bounded Monte Carlo sample configuration | **PASS** | Default `-n 10000` (10,000 samples), bounded between 1,000 and 120,000 in [src/config.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/config.ts). |
| **P3c**| Pinned `requirements-class1.txt` | **PASS** | [requirements-class1.txt](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/requirements-class1.txt); pinned `class1==0.1.0`, numpy, pandas, pydantic. |
| **P4** | 8 PRD Tools with exact names and schemas | **PASS** | All 8 PRD database & telemetry tools registered in [src/modules/class1/class1.tools.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/modules/class1/class1.tools.ts). |
| **P4** | 2 Class1 Engine Tools (`estimate_pr_cost`, `get_cost_verdict`) | **PASS** | Implemented and verified live over Streamable HTTP ([scripts/verify-e2e.mjs](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/scripts/verify-e2e.mjs)). |
| **P4** | Vitest unit test suite | **PASS** | `npm test` passes 23 of 23 unit tests across 3 test files. |
| **P4** | Full upstream Pytest test suite | **NOT VERIFIED** | 469 items collected; 37 test files fail collection due to unbundled `autobuild` and `blue_book.prices` packages (Upstream Packaging Defect #2). Of collectable tests: 430 passed, 4 failed (missing snapshots/resources), 6 skipped, 23 deselected by `"not footprint"`. |
| **P4** | Multi-tenant namespace isolation over HTTP | **PASS** | [scripts/test_tenant_isolation_http.mjs](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/scripts/test_tenant_isolation_http.mjs); caller cannot read/modify records of other `userId`s within trust domain. |
| **P4** | Edge cases & resilience verification | **PASS** | [scripts/test_edge_cases.mjs](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/scripts/test_edge_cases.mjs); invalid UUID, missing fields, empty code, oversized, timeouts, rate limits. |
| **P4** | Database reconnection & HTTP 503 handling | **PASS** | [scripts/test_db_break_recovery.mjs](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/scripts/test_db_break_recovery.mjs); broken DB returns 503 without credential leak, then recovers to 200. |
| **P4** | Audit logs for validation & engine failures | **PASS** | [scripts/test_trigger_failures_audit.mjs](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/scripts/test_trigger_failures_audit.mjs); verified `VALIDATION_FAILED` and `ENGINE_FAILURE` in Neon. |
| **P4** | Cold restart data persistence | **PASS** | [scripts/test_restart_persistence.mjs](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/scripts/test_restart_persistence.mjs); pre-reboot records retrieved intact post-reboot. |
| **P5** | Production multi-stage Dockerfile | **PASS** | [Dockerfile](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/Dockerfile); Debian Bookworm, non-root `USER node`, curl `HEALTHCHECK`. |
| **P5** | Docker container build & execution | **NOT VERIFIED** | Docker daemon is not installed on this Windows host (`docker` is not recognized). The image could not be built or run. |
| **P5** | Python runtime in Debian container | **NOT VERIFIED** | Debian Bookworm supplies Python 3.11; our local pinned environment was executed and tested on Python 3.14.6. |
| **P5** | Node.js 22 runtime compliance | **NOT VERIFIED** | Specification calls for Node 22; local development host runs Node v24.17.0. |
| **P5** | Cross-platform Windows entrypoint checks | **PASS** | [src/db/migrate.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/db/migrate.ts) & [src/db/seed.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/db/seed.ts) use case-insensitive resolved paths. |
| **P6** | Clean repository secret scan (0 leaks) | **PASS** | [scripts/scan_secrets.py](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/scripts/scan_secrets.py); 0 live credentials leaked across repository tree and git commits. |
| **P6** | Remove deprecated `src/tools/index.ts` & `handlers.ts` | **PASS** | Confirmed both files removed; only [src/tools/schemas.ts](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/src/tools/schemas.ts) remains. |
| **P6** | Scripted verification of all README file paths | **PASS** | [scripts/check_readme_refs.py](file:///E:/Nitrostack/Task%20Third/neon-mcp-server/scripts/check_readme_refs.py); confirmed all referenced files exist on disk. |
| **P6** | Fresh-clone README-only reproduction | **PASS** | Clean `git archive` export tested step-by-step; compiled with 0 errors, passed all 23 unit tests, started server, and successfully ran live `estimate_pr_cost` tool call. |
| **P6** | Atomic git history & zero push constraint | **PASS** | 10 atomic commits created locally; working tree clean; zero commits pushed. |

---

## 2. Key Gap Check Verification Evidence

### 1. TypeScript Strict Check & Production Build
```text
$ npx tsc --noEmit
(Exit Code 0: Zero Errors)

$ npm run build
> class1-neon-mcp-server@1.0.0 build
> nitrostack build
┌──────────────────────────────────────────────────────────────────┐
│  ✓ Build Complete (4.9s)                                         │
│    dist                                                          │
└──────────────────────────────────────────────────────────────────┘
```

### 2. Seed Idempotency Check (Run Twice)
```text
$ npm run db:seed
🌱 Seeding Neon PostgreSQL with Class1Dev baseline records (idempotent)...
👤 Active User configured: Class1Dev Software Engineering Team (00000000-0000-0000-0000-000000000001)
✅ Class1Dev seeding complete. Ready for MCP tool calls.

$ npx tsx scripts/show_counts.ts
Neon Database Counts -> Users: 1, Records: 2, Audit Logs: 137

$ npm run db:seed
🌱 Seeding Neon PostgreSQL with Class1Dev baseline records (idempotent)...
👤 Active User configured: Class1Dev Software Engineering Team (00000000-0000-0000-0000-000000000001)
✅ Class1Dev seeding complete. Ready for MCP tool calls.

$ npx tsx scripts/show_counts.ts
Neon Database Counts -> Users: 1, Records: 2, Audit Logs: 137
(Verification: Record counts are identical and unchanged across runs)
```

### 3. Database Break, HTTP 503 Sanitization & Recovery
```text
$ node scripts/test_db_break_recovery.mjs
[Step 1] Starting server with REAL, valid DATABASE_URL...
   HTTP Status: 200 (Healthy Baseline)
   Connected:   true
   DB Latency:  231ms

[Step 2] Starting server with BROKEN database connection...
   HTTP Status:       503 (Verified HTTP 503 Service Unavailable)
   Overall Status:    UNHEALTHY
   DB Connected:      false
   Sanitized Error:   Database authentication failed. Please verify credentials.
   Credential Leak?   PASSED (0 Credential Leaks)

[Step 3] Restoring server with REAL, valid DATABASE_URL (Recovery)...
   HTTP Status: 200 (Verified RECOVERY to 200 OK)
   Connected:   true
   DB Latency:  288ms
```

### 4. Upstream Pytest Test Suite & Packaging Defect Breakdown
Running `pytest` against the extracted sdist test suite yields:
- **Total test items discovered:** 469 items across 100 test files.
- **Uncollectable modules (Upstream Packaging Defect #2):** 37 test files fail during collection because the distributed `class1==0.1.0` archive does not contain internal development packages:
  - `autobuild` (e.g. `autobuild.provider`, `autobuild.driver`, `autobuild.metering`, `autobuild.roadmap`, `autobuild.router`)
  - `blue_book.prices` (e.g. `blue_book.prices.api_sources`, `blue_book.prices.fetch_wayback`, `blue_book.prices.structure`)
  - `blue_book.capability` (e.g. `blue_book.capability.analyze`, `blue_book.capability.swebench`)
  - `blue_book.spec` (e.g. `blue_book.spec.extract`)
- **Deselected by `"not footprint"`:** 23 tests across 5 test files (`test_footprint_actuals.py`, `test_footprint_carbon.py`, `test_footprint_materials.py`, `test_footprint_mc.py`, `test_footprint_water.py`).
- **Collectable tests execution:** 430 passed, 4 failed (requiring local benchmark snapshot datasets not bundled in the tarball), 6 skipped (`tree-sitter is optional; estimate_pr degrades to Python-only`, unbuilt datasets, missing yaml).
- **Core Cost Math Confirmation:** All core cost simulation and estimation modules (`test_monte_carlo.py`, `test_scenario.py`, `test_contingency.py`, `test_escalation.py`, `test_policy_gate.py`) pass without importing footprint.

### 5. Transport Configuration & Protocol Handling
- **Server Binding:** Defaults to `127.0.0.1` (configurable via `HOST` environment variable).
- **CORS Configuration:** Restricted to `http://localhost:3000`, `http://127.0.0.1:3000`, and `http://localhost:5173`.
- **Cloud Deployment Block:** Removed the `cloud:` section from `nitrostack.config.ts` to keep configuration strictly local.
- **Protocol Era Compatibility:**
  `process.env.NITRO_MCP_PROTOCOL_VERSION = 'legacy'` in `src/index.ts` is strictly required. When omitted, `@nitrostack/core` defaults to `2026-07-28` ("Modern MCP"), which throws `Modern MCP handler error: inputSchema/outputSchema/argsSchema must be a Standard Schema` on Zod schemas and causes `POST /mcp` initialization to fail with HTTP 500.

### 6. Dependency Security Audit (`npm audit`)
```text
$ npm audit
16 vulnerabilities (11 moderate, 3 high, 2 critical)
- @vitest/mocker <=4.1.11 (moderate: path traversal / mock injection)
- drizzle-orm <0.45.2 (high: SQL identifier escaping)
- esbuild <=0.24.2 (moderate: dev server request authorization)
- glob 9.0.0-14.0.1 (moderate: post-timeout traversal)
- minimatch 7.0.0-11.0.0 (moderate: ReDoS)
- tinypool <=2.1.1 (critical: prototype pollution in worker options)
- zod <4.6.6 (high: constrained collection memory exhaustion)
```
*Note:* Upgrading these dependencies would require breaking changes (`--force`), including major version shifts in `@nitrostack/core` and `drizzle-kit`.

### 7. Fresh-Clone README-Only Reproduction
A fresh clone was created in an isolated directory via `git archive master` and executed exclusively using the commands documented in `README.md`:
1. Created `.env` from `.env.example` with valid credentials.
2. Initialized virtual environment and installed pinned packages (`pip install -r requirements-class1.txt`).
3. Ran `npm install`, `npm run db:migrate`, and `npm run db:seed`.
4. Compiled application via `npm run build` (0 TypeScript errors).
5. Ran `npm test` (all 23 Vitest unit tests passed).
6. Started server and invoked `estimate_pr_cost` over Streamable HTTP:
   - Initialized session returning HTTP 200.
   - Evaluated PR diff returning HTTP 200 with `verdict: PASS`, `expected: 2840.21`, `p90: 5808.20`, and disclaimer: `"Ecological footprint: NOT COMPUTED"`.
   - Stored estimate record verified in Neon PostgreSQL.

---

## 3. Trust Domain & Multi-Tenant Model

1. **Single Trust Domain (Shared Bearer Secret):**
   - The MCP HTTP endpoint (`POST /mcp`) is protected by a single shared secret (`AUTH_SECRET`).
   - All authenticated requests belong to the same organizational trust domain.
2. **`userId` as a Namespace Selector:**
   - The `userId` argument in tool parameters acts as a **logical partition/namespace selector** within this trust domain, analogous to a project or workspace selector.
   - It is **not** an independent cryptographic identity or tenant authentication barrier.
3. **Default Behavior:**
   - Unspecified `userId` defaults to the authenticated default principal (`DEFAULT_USER_ID`: `00000000-0000-0000-0000-000000000001`).
   - Within this model, `RecordService` prevents accidental cross-namespace reads and mutations unless `ALLOW_CROSS_TENANT_READS=true` is explicitly set in configuration.

---

## 4. Known Limitations

1. **Missing Upstream Footprint Module:**
   - `cost_engine.footprint` is absent from upstream `class1==0.1.0`. Handled via safe repository wrapper `python/run_class1.py` with 14-symbol disclaimer. Carbon, water, and material calculations are disabled.
2. **Pricing Snapshot Age:**
   - Embedded pricing data (`snapshots/prices.json`) is from a snapshot approximately 159 days old. Newer models like `gpt-4.5-preview` are not resolved.
3. **Class 5 Accuracy Band:**
   - Estimates are uncalibrated Class 5 screening forecasts (-50% to +100% variance maturity).
4. **Local TypeScript Verdict Logic:**
   - Approval verdicts (`BLOCK`, `WARN`, `PASS`, `NO_BUDGET`) are calculated locally in TypeScript using the P90 Monte Carlo delta and `CLASS1_WARN_FRACTION` (default 0.8), rather than Class1's proprietary enterprise gate.
5. **Default Monte Carlo Samples:**
   - By default, the service executes **10,000 samples** (`-n 10000`), bounded between 1,000 and 120,000.
6. **Host & Container Environment Discrepancies:**
   - Spec specifies Node 22; local development host runs Node v24.17.0.
   - Python dependencies were verified on Python 3.14.6 locally; Dockerfile targets Debian Python (typically 3.11).
   - Docker daemon was unavailable on host; Dockerfile was validated syntactically but not built or executed.
7. **Third-Party Vulnerabilities:**
   - `npm audit` reports 16 vulnerabilities in upstream dependencies that cannot be resolved without breaking API changes in `@nitrostack/core` or `drizzle-orm`.

---

## 5. Open Questions for Mentor

1. **Upstream Footprint Module:**
   Will the package authors publish an official `class1==0.1.1` release containing `cost_engine/footprint.py`, or should the repository wrapper (`python/run_class1.py`) be treated as the permanent integration architecture?
2. **Second Upstream Packaging Defect:**
   The sdist archive bundles 37 test files referencing unbundled monorepo packages (`autobuild`, `blue_book.prices`, `blue_book.capability`, `blue_book.spec`). Should our test harness maintain exclusions for these files indefinitely, or will an upstream sdist cleanup remove them?
3. **`WARN` Verdict Threshold Configuration:**
   The `WARN` threshold is currently configured globally via `CLASS1_WARN_FRACTION` (default 0.8). Should this threshold be customizable per PR or per repository through tool arguments?
4. **Tenant Authentication Architecture:**
   Is a single shared Bearer token (`AUTH_SECRET`) with `userId` as a collaborative workspace/namespace selector sufficient for production deployment, or does Class1Dev require true per-tenant cryptographic authentication (such as per-tenant JWTs or scoped API keys)?
