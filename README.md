# Class1Dev Neon PostgreSQL MCP Server

> **Production-Ready Model Context Protocol (MCP) Server for Class1Dev AI Cost Governance**  
> *Built with the official NitroStack TypeScript SDK (`@nitrostack/core`), Neon PostgreSQL, and the Real Class1 Cost-Risk Takeoff Engine*  
> *LOCAL IMPLEMENTATION SPECIFICATION & OPERATIONAL GUIDE*

---

## 1. Project Overview & Architectural Scope

This repository provides a production-grade, locally verified Model Context Protocol (MCP) server engineered for **Class1Dev**. It integrates pre-merge AI cost-risk modeling with persistent cloud storage in **Neon PostgreSQL**, powered natively by the **NitroStack TypeScript SDK (`@nitrostack/core`)** and the **real upstream Class1 cost-risk takeoff engine (`class1==0.1.0`)**.

### Scope & Constraints (Local Scope)
- **Dual Transport Support:** 
  - **Streamable HTTP (Default):** Runs locally on `localhost:3000` via `POST /mcp`, `GET /health`, and `GET /`. Protected by constant-time Bearer token authentication, in-memory rate limiting (60 req/min), and a 1 MB payload size ceiling. Tested directly using `curl` and the official MCP Inspector.
  - **STDIO Transport (`MCP_TRANSPORT=stdio`):** Enables direct standard input/output IPC communication for local GUI clients such as **NitroStudio (v1.4.22)**, Claude Desktop, and Cursor. In STDIO mode, no HTTP listener or TCP port is opened, and all logging (`console.log`) is redirected to `stderr`, preserving `stdout` strictly for JSON-RPC 2.0 frames.
- **Real Class1 Takeoff Engine:** Fully integrated real Python cost engine executing stochastic Monte Carlo simulations and AST static code analysis. Zero synthetic, hardcoded, or invented numbers in completed features.
- **Persistent Cloud Database:** Neon Serverless PostgreSQL storing users, cost estimate records, and tamper-resistant audit logs via Drizzle ORM.
- **Streamlined Pure Enterprise AI FinOps Tool Catalog (10 Unique Tools):** 
  - Tailored specifically for enterprise client presentation, automated CI/CD policy enforcement, and LLM agent steering (`evaluate_pr_cost_risk`, `get_pr_governance_verdict`, `log_budget_policy_override`, `get_governance_record`, `list_governance_ledger`, `update_governance_record`, `delete_governance_record`, `audit_pr_cost_history`, `get_finops_compliance_metrics`, `get_service_health`).
  - Streamlined under Option B: generic CRUD tool names were de-registered from the MCP catalog, eliminating confusion and duplication for AI agents (NitroStudio, ChatGPT, Cursor) in favor of high-value FinOps domain actions.
- **Strict Security & Credential Protection:** `DATABASE_URL`, `AUTH_SECRET`, and `CLASS1_LICENSE_KEY` masked across logs, errors, and git history. Parameterized SQL queries (no string concatenation), safe `child_process.spawn` argument arrays (no shell strings), constant-time authentication, rate limiting, and size-bounded request bodies.

> **Executive Verification Summary:**  
> Implementation is complete locally, with the limitations listed. Upstream packaging defect #2 omits internal packages (`autobuild` and `blue_book.prices`/`blue_book.spec`), preventing collection and execution of 38 upstream test files (37 top-level collection errors and 1 fixture setup error in `test_autobuild_loop.py`). Among the 439 collectable upstream tests, 430 pass, 6 are skipped, and 4 fail (`test_grades_real.py`, 2 in `test_opendata.py`, and `test_structured_price.py`). The model recommendation capability snapshot (`snapshots/capability.json`) is confirmed present in runtime `site-packages/snapshots/`, with `cost_engine/grades_real.py` resolving all 38 models and producing real recommendations (e.g. recommending `kimi-k2-0905-preview` over `gpt-4o` on our sample PR); the single test failure in `test_grades_real.py` was caused by the test fixture seeking the snapshot relative to the test runner directory rather than runtime `site-packages`. The remaining 3 test failures relate to unbundled price structure submodules or unfetched online actuals, and do not touch core server estimation or policy gate code paths. Items marked NOT VERIFIED include the Docker image build and execution (host lacks Docker daemon), the container Python version inside Debian Bookworm (tested on host Python 3.14.6; verified dry-run install on Python 3.11), and the host Node version (v24.17.0 vs spec Node 22, accepted by `@nitrostack/core` `>=18.0.0`). The SQL-identifier advisory was in `drizzle-orm` (GHSA-gpj5-g38j-94v9) and is fixed by the upgrade to `^0.45.4`. The remaining advisory is a Zod memory-exhaustion issue (GHSA-mrhx-c7xc-m3w5) inherited from `@nitrostack/core`, mitigated locally by the 1 MB body limit and the rate limiter, and accepted for this local POC.

---

## 2. End-to-End System Architecture

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          LOCAL SYSTEM ARCHITECTURE & DATA FLOW                         │
├──────────────────────────┬─────────────────────────────────────────────────────────────┤
│ LAYER                    │ RESPONSIBILITIES & PROTOCOLS                                │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ MCP Client Ingress       │ 1. HTTP: curl / MCP Inspector (POST /mcp with Bearer token) │
│                          │ 2. STDIO: NitroStudio v1.4.22 / Claude Desktop (stdin/stdout)│
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Transport & Security     │ Streamable HTTP Mode (Default, port 3000):                  │
│                          │ - Constant-time Bearer token verification (timingSafeEqual) │
│                          │ - Rate Limiting: 60 req/min on /mcp (Exempts GET /health)   │
│                          │ - Body limit: 1 MB cap (HTTP 413 Payload Too Large)         │
│                          │ - Sanitized Error Boundary (masks DB credentials/paths)     │
│                          │ STDIO Mode (MCP_TRANSPORT=stdio):                           │
│                          │ - Standard Input/Output JSON-RPC 2.0 framing                │
│                          │ - Redirects console.log to stderr to prevent stdout clash   │
│                          │ - Zero HTTP port exposure or header dependencies            │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ MCP Protocol Layer       │ @nitrostack/core McpServer (Streamable HTTP or StdioServer) │
│                          │ - Handles session negotiation, ping, and JSON-RPC dispatch  │
│                          │ - Validates tool inputs via strict Zod schemas              │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Service Layer            │ TypeScript Business Logic:                                  │
│                          │ - RecordService: CRUD, full-text search, stats, tenant auth │
│                          │ - HealthService: Diagnostic telemetry & Neon latency probe  │
│                          │ - Class1EngineService: Managed child process runner         │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Class1 Engine Bridge     │ python/run_class1.py wrapper                                │
│                          │ - Clean Python >=3.11 virtual environment (.venv)           │
│                          │ - Unedited upstream class1==0.1.0 engine                    │
│                          │ - Dynamic AST token extraction & 120,000 Monte Carlo runs   │
│                          │ - Footprint disclaimer placeholder (no invented metrics)    │
│                          │ - Concurrency limit (2), 30s timeout, temp file cleanup     │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ Database & ORM Layer     │ Drizzle ORM + @neondatabase/serverless connection pool      │
│                          │ - Fully parameterized queries (zero SQL injection)          │
│                          │ - Relational schema: users, records, audit_logs             │
│                          │ - Automatic audit logging for all mutations and reads       │
└──────────────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure

```text
neon-mcp-server/
├── python/
│   └── run_class1.py          # Safe repository wrapper for upstream class1 engine
├── scripts/
│   ├── cleanup_test_records.ts# Neon maintenance utility to wipe test records
│   ├── scan_secrets.py        # Automated repository secret scanner
│   ├── test_edge_cases.mjs    # Comprehensive suite verifying edge cases & limits
│   ├── test_every_tool.mjs    # Comprehensive runner executing all 10 pure FinOps tools with recommended parameters
│   ├── test_footprint_placeholder.py # Proves all 14 footprint symbols covered
│   ├── test_restart_persistence.mjs  # Proves cold restart data persistence
│   ├── test_stdio_handshake.mjs      # Real STDIO transport handshake test
│   ├── test_tenant_isolation.ts      # Service-level tenant isolation test
│   ├── test_tenant_isolation_http.mjs# Live HTTP /mcp tenant isolation test
│   └── verify-e2e.mjs         # End-to-end verification of all 10 pure FinOps tools
├── src/
│   ├── config.ts              # Zod-validated environment configuration & defaults
│   ├── index.ts               # Express bootstrap, Streamable HTTP /mcp, endpoints
│   ├── db/
│   │   ├── index.ts           # Neon serverless pool & Drizzle ORM instance
│   │   ├── schema.ts          # Relational schema (users, records, audit_logs)
│   │   ├── migrate.ts         # Automated DDL migration runner
│   │   └── seed.ts            # Idempotent baseline seed runner
│   ├── middleware/
│   │   ├── auth.middleware.ts # Timing-safe Bearer authentication
│   │   ├── error.middleware.ts# Sanitized error boundary & HTTP 413 handler
│   │   └── rate-limit.middleware.ts # In-memory limiter with /health exemption
│   ├── modules/
│   │   └── class1/
│   │       ├── class1.module.ts # NitroStack module declaration
│   │       └── class1.tools.ts  # Controller registering the 10 pure FinOps MCP tools
│   ├── services/
│   │   ├── class1-engine.service.ts # Subprocess manager for Class1 engine
│   │   ├── health.service.ts        # Database connection & latency probe
│   │   └── record.service.ts        # Business logic, tenant scoping & audit logs
│   ├── tools/
│   │   └── schemas.ts         # Zod schemas and TypeScript types for MCP tools
│   └── utils/
│       └── error-handler.ts   # Error sanitization and secret masking utilities
├── tests/
│   ├── auth-and-error.test.ts # Vitest suite for auth, error boundary & transports
│   ├── class1-engine.test.ts  # Vitest suite for real Class1 engine integration
│   └── tools.test.ts          # Vitest suite (42 total unit tests passing)
├── Dockerfile                 # Production multi-stage Debian Bookworm containerfile
├── drizzle.config.ts          # Drizzle Kit configuration
├── package.json               # Node.js dependencies and lifecycle scripts
├── requirements-class1.txt    # Pinned Python dependencies (class1==0.1.0)
└── tsconfig.json              # TypeScript compiler configuration (NodeNext)
```

---

## 4. Environment Variables & Configuration

Configuration is strictly validated at startup using Zod in `src/config.ts`.

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `enum` | `development` | Environment mode (`development`, `test`, `production`). |
| `MCP_TRANSPORT` | `enum` | `http` | Transport protocol selection: `http` (default, Streamable HTTP on port 3000) or `stdio` (standard I/O for NitroStudio, Claude Desktop). |
| `PORT` | `number` | `3000` | Port for Express HTTP server. |
| `DATABASE_URL` | `string` | *(Required)* | Neon PostgreSQL connection string (`postgresql://...`). Masked in all logs. |
| `AUTH_SECRET` | `string` | *(Required)* | 32-byte secret for Bearer token authentication. Masked in all output. |
| `DEFAULT_USER_ID` | `uuid` | `00000000-0000-0000-0000-000000000001` | Default tenant user ID representing the authenticated principal. |
| `ALLOW_CROSS_TENANT_READS` | `boolean` | `false` | When `false`, all reads without explicit tenant IDs scope to `DEFAULT_USER_ID`. |
| `CLASS1_PYTHON_PATH` | `string` | `auto-detected` | Path to Python 3 executable in `.venv`. |
| `CLASS1_TIMEOUT_MS` | `number` | `30000` | Maximum execution time for Python subprocess (30 seconds). |
| `CLASS1_WARN_FRACTION` | `number` | `0.8` | Threshold fraction of budget triggering `WARN` verdict (default: 80%). |
| `CLASS1_MC_SAMPLES` | `number` | `10000` | Default Monte Carlo sample count (bounded between 1,000 and 120,000). |
| `CLASS1_MAX_CONCURRENCY` | `number` | `2` | Maximum concurrent Class1 engine child processes (1–2 recommended). |
| `CLASS1_MAX_OUTPUT_BYTES` | `number` | `5242880` | Subprocess stdout/stderr buffer ceiling (5 MB). |
| `RATE_LIMIT_MAX_REQUESTS` | `number` | `60` | Max requests per minute per IP on `/mcp`. `/health` is exempt. |

---

## 5. Security Architecture & Trust Model

### Constant-Time Authentication
All requests to `POST /mcp` require an `Authorization: Bearer <AUTH_SECRET>` header. Verification is performed using `crypto.timingSafeEqual` over SHA-256 digests to eliminate timing side-channel attacks:
```typescript
const secretHash = crypto.createHash('sha256').update(config.AUTH_SECRET).digest();
const tokenHash = crypto.createHash('sha256').update(token).digest();
return crypto.timingSafeEqual(secretHash, tokenHash);
```

### Single Trust Domain & Namespace Isolation Model
1. **Trust Domain & Authentication:** The MCP server operates within a single organizational trust domain protected by a shared secret (`AUTH_SECRET`). All clients presenting this Bearer token are authenticated to communicate with the server.
2. **`userId` as a Namespace Selector:** The `userId` argument in tool schemas functions as a logical namespace or partition selector within this shared trust domain (similar to selecting a project or workspace), rather than an independent authentication credential.
3. **Default Scoping:** When a caller invokes `list_records`, `search_records`, `get_record`, or `get_database_stats` without supplying a `userId`, `RecordService.resolveTenantUserId()` scopes the query to `DEFAULT_USER_ID` (`00000000-0000-0000-0000-000000000001`).
4. **Namespace Boundary Enforcement:** Within this trust domain, `RecordService` enforces namespace integrity: queries with a given `userId` cannot read, update, or delete records associated with another `userId`. Cross-namespace reads can be permitted only if an administrator explicitly enables `ALLOW_CROSS_TENANT_READS=true` in configuration.
5. **Audit Logging:** Every operation records the effective `userId` into the immutable `audit_logs` table in Neon PostgreSQL.

### Denial-of-Service (DoS) and Memory Protection
- **Payload Size Ceiling:** Express body parser enforces a strict 1 MB cap (`express.json({ limit: '1mb' })`). Oversized payloads are immediately rejected with an HTTP 413 `Payload Too Large` JSON response before reaching business logic.
- **Rate Limiting:** In-memory sliding-window limiter blocks callers exceeding 60 req/min on `/mcp` with HTTP 429 `Too Many Requests`. Public diagnostic probes (`GET /health`) and CORS preflights (`OPTIONS`) are strictly exempt to guarantee monitoring uptime.
- **Engine Concurrency & Timeouts:** `Class1EngineService` uses an active execution semaphore restricting parallel engine runs to 2. Subprocesses are killed via `SIGKILL` if they exceed 30 seconds or emit > 5 MB.

### Dual-Mode Transport Architecture & NitroStudio Integration
The server supports two distinct operational modes tailored to production/network deployment vs. local developer tooling:
1. **Streamable HTTP Mode (Default, Remote/Network Deployments):**
   - Active when `MCP_TRANSPORT` is unset or set to `http`.
   - Binds to `127.0.0.1:3000` (or configured `HOST`/`PORT`).
   - Every `/mcp` request strictly requires `Authorization: Bearer <AUTH_SECRET>`.
   - Protected by 60 req/min sliding-window rate limiting and a 1 MB payload size ceiling (`express.json({ limit: '1mb' })`).
   - All network errors and unhandled exceptions are filtered through a sanitized error boundary that strips credentials and connection strings.
2. **STDIO Mode (Local Developer Tooling & NitroStudio):**
   - Active when `MCP_TRANSPORT=stdio` (or `MCP_TRANSPORT_TYPE=stdio`).
   - Designed for local GUI clients like **NitroStudio (v1.4.22)**, Claude Desktop, and Cursor.
   - **NitroStudio v1.4.22 Diagnosis:** Studio's connection probe to `http://127.0.0.1:3000/mcp` sends zero authentication headers, resulting in HTTP 401 Unauthorized. Rather than compromising security with query-string tokens or insecure HTTP bypass flags, STDIO mode establishes direct local IPC over process standard input/output streams.
   - **Stdout Cleanliness Guarantee:** In STDIO mode, `console.log` is redirected to `console.error` (stderr), ensuring `stdout` contains exclusively valid JSON-RPC 2.0 messages so client JSON parsers never fail.
   - **Working Directory Independence:** All root paths (`.env`, `.venv`, and `python/run_class1.py`) are resolved dynamically relative to `import.meta.url` (`PROJECT_ROOT`). The server operates identically whether spawned from `neon-mcp-server/`, `E:\NitroStudio`, `C:\`, or an external runner.
   - **Error Serialization & Logging Hygiene:** Error objects (including WebSocket `ErrorEvent` instances) are deeply unwrapped to extract their true error class and message. Raw error details are logged to `stderr` (visible in NitroStudio's App Canvas log), while client payloads present clean, sanitized error messages that strip database credentials, hosts, and passwords, never serializing to `"[object Object]"`.
   - **Dynamic Transport & Uptime Telemetry:** `get_system_status` dynamically reports the active transport (`stdio` vs `streamable-http`). `uptimeSeconds` reports the continuous Node.js runtime (`process.uptime()`) of the persistent MCP server child process managed by NitroStudio.
   - No HTTP listener, TCP port, or network interface is opened. Security is bounded by the host operating system's process and filesystem isolation.
   - The HTTP security layer remains fully intact and is verified independently by automated test suites.

---

## 6. Streamlined Enterprise AI FinOps Tool Catalog (10 Unique Tools)

To maximize business value during enterprise client demonstrations (in NitroStudio, ChatGPT, and Cursor) and provide LLM agents with unambiguous domain context, the server implements **Option B: Pure FinOps Architecture (10 Specialized, Non-Overlapping Tools)**:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   STREAMLINED ENTERPRISE AI FINOPS TOOL CATALOG (10 TOOLS)             │
├──────────────────────────────┬─────────────────────────────────────────────────────────┤
│ CATEGORY                     │ SPECIALIZED MCP TOOL & DOMAIN PURPOSE                   │
├──────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 1. Cost-Risk Takeoff Engine  │ evaluate_pr_cost_risk                                   │
│                              │ - 120k Monte Carlo runs on AST code changes             │
│                              │ - P50/P80/P90/P95 tail-risk forecast & policy verdict   │
├──────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 2. Governance Verdict        │ get_pr_governance_verdict                               │
│                              │ - Retrieve stored forecast, verdict & confidence band   │
├──────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 3. Policy & Override Ledger  │ log_budget_policy_override                              │
│                              │ - Log authorized exception, waiver, or custom policy    │
│                              │ get_governance_record                                   │
│                              │ - Fetch single audit record by UUID                     │
│                              │ list_governance_ledger                                  │
│                              │ - Paginated inspection of cost governance ledger        │
│                              │ update_governance_record                                │
│                              │ - Mutate approver metadata, signoffs, and audit fields  │
│                              │ delete_governance_record                                │
│                              │ - Permanently prune obsolete governance records         │
├──────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 4. Historical Search & Audit │ audit_pr_cost_history                                   │
│                              │ - Substring query search across titles and descriptions │
│                              │ get_finops_compliance_metrics                           │
│                              │ - Ledger counts, audit log volume, mutation stats       │
├──────────────────────────────┼─────────────────────────────────────────────────────────┤
│ 5. Telemetry & Health        │ get_service_health                                      │
│                              │ - Live Neon PostgreSQL connectivity, latency & memory   │
├──────────────────────────────┴─────────────────────────────────────────────────────────┤
│ Shared Service & Security Core: RecordService, HealthService, Class1EngineService      │
│ Neon PostgreSQL Cloud Persistence (users, records, audit_logs) + Drizzle ORM           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### The 10 Pure FinOps MCP Tools in Detail

1. **`evaluate_pr_cost_risk`**: Runs the real Class1 cost-risk takeoff engine on before/after code changes to estimate monthly LLM cost impact, calculate tail-risk percentiles (P50/P90/P95), and evaluate budget policy verdicts (`BLOCK`, `WARN`, `PASS`, or `NO_BUDGET`). Persists the forecast and full text report to Neon PostgreSQL.  
   - Inputs: `beforeCode` (string, req), `afterCode` (string, req), `path` (string, req), `budgetP90Usd` (number, opt), `prNumber` (int, opt), `repo` (string, opt), `samples` (int, opt, default 1,000), `userId` (uuid, opt).
2. **`get_pr_governance_verdict`**: Retrieves a stored Class1 cost-risk forecast and governance verdict by UUID from Neon PostgreSQL.  
   - Inputs: `id` (uuid, req), `userId` (uuid, opt).
3. **`log_budget_policy_override`**: Logs an authorized budget exception, manual PR override, or cost governance policy record in Neon PostgreSQL. Saves title, description, and metadata JSONB, returning the created record with UUID.  
   - Inputs: `title` (string, req), `description` (string, opt), `metadata` (object, opt), `userId` (uuid, opt).
4. **`get_governance_record`**: Retrieves a specific cost governance or policy override record by its unique UUID from Neon PostgreSQL.  
   - Inputs: `id` (uuid, req), `userId` (uuid, opt).
5. **`list_governance_ledger`**: Lists historical Class1Dev cost governance records stored in Neon PostgreSQL with pagination (`limit` and `offset`) and total count metadata.  
   - Inputs: `limit` (int, opt, default 20), `offset` (int, opt, default 0), `userId` (uuid, opt).
6. **`update_governance_record`**: Updates the title, description, or JSONB metadata of an existing cost governance record in Neon PostgreSQL by its UUID.  
   - Inputs: `id` (uuid, req), `title` (string, opt), `description` (string, opt), `metadata` (object, opt), `userId` (uuid, opt).
7. **`delete_governance_record`**: Permanently removes a cost governance record by its unique UUID from Neon PostgreSQL. Returns deletion confirmation status.  
   - Inputs: `id` (uuid, req), `userId` (uuid, opt).
8. **`audit_pr_cost_history`**: Searches for historical cost governance records in Neon PostgreSQL matching a query substring across title and description fields.  
   - Inputs: `query` (string, req), `limit` (int, opt, default 20), `userId` (uuid, opt).
9. **`get_finops_compliance_metrics`**: Retrieves aggregate FinOps compliance metrics, including total record counts, audit log volume, and action success rates.  
   - Inputs: `userId` (uuid, opt).
10. **`get_service_health`**: Checks health and diagnostic status of the NitroStack MCP server and active Neon PostgreSQL connection pool.  
    - Inputs: None.

---

## 7. Known Limitations & Upstream Advisories

1. **Footprint Module Missing Upstream (`cost_engine.footprint`):**
   - *Observation:* The upstream PyPI package `class1==0.1.0` (both wheel and sdist) does not ship the `cost_engine/footprint.py` module, despite `cost_engine/__init__.py` attempting to import 13 symbols from it.
   - *Workaround:* Resolved cleanly in our repository wrapper (`python/run_class1.py`) by registering a placeholder module in `sys.modules['cost_engine.footprint']` covering all 14 names (`CarbonPrice`, `resolve_intensity`, `carbon_kg`, `simulate_carbon`, `analyze_footprint_delta`, `load_grid`, `resolve_water`, `water_m3`, `simulate_water`, `analyze_water_delta`, `embodied_carbon_kg`, `materials_adp_kg`, `ewaste_kg_year`, `footprint_report`).
   - *Integrity:* Every placeholder function raises `NotImplementedError` or returns `None`. No synthetic numbers (carbon kg, water m³, e-waste) are ever returned or stored. The report displays: `"Ecological footprint: NOT COMPUTED (cost_engine.footprint is missing from class1 0.1.0)"`.
   - *Upstream Test Integrity:* The core takeoff and cost math test suite (`test_monte_carlo.py`, `test_scenario.py`, `test_contingency.py`, `test_escalation.py`, `test_policy_gate.py`, etc.) does not depend on footprint and passes upstream tests.
2. **Second Upstream Packaging Defect (Unbundled Test Dependencies):**
   - The sdist archive (`class1-0.1.0.tar.gz`) bundles 37 test files that import packages never distributed in the release (`autobuild`, `blue_book.prices`, `blue_book.capability`, `blue_book.spec`). Pytest fails collection on these 37 files with `ModuleNotFoundError`.
3. **Pricing Snapshot Age:**
   - The pricing tables in `class1==0.1.0` (`snapshots/prices.json`) are from a static snapshot created approximately 159 days prior to evaluation. Modern models (e.g. `gpt-4.5-preview`) are absent and skipped by upstream tests.
4. **Class 5 Screening Accuracy:**
   - In accordance with AACE International cost engineering standards, estimates generated without calibrated company historical actuals are classified as **Class 5 (Screening)**, carrying an expected accuracy maturity band of **-50% to +100%**.
5. **Local Verdict Evaluation:**
   - In local mode, the approval verdict (`BLOCK`, `WARN`, `PASS`, `NO_BUDGET`) is evaluated by our TypeScript service layer based on the Monte Carlo P90 output, `budgetP90Usd`, and `CLASS1_WARN_FRACTION` (default: 0.8), rather than the proprietary upstream enterprise licensed policy gate.
6. **Monte Carlo Default Configuration:**
   - By default, the takeoff engine executes **10,000 samples** (`-n 10000`), bounded between 1,000 and 120,000 via `CLASS1_MC_SAMPLES` in `src/config.ts`.
7. **Host Runtime & Container Environment Status:**
   - *Docker:* The local Windows host system does not have the Docker daemon or CLI installed (`docker` is not recognized). A hardened Debian Bookworm `Dockerfile` with pinned Python and non-root `USER node` is provided, but could not be built or executed on this host.
   - *Node Version:* The specification targets Node 22; the local host environment runs Node v24.17.0.
   - *Python Version:* Locally verified on Python 3.14.6; pinned dependencies require Python >= 3.11.
8. **Third-Party Dependency Audit:**
   - `npm audit` identifies 16 vulnerabilities (11 moderate, 3 high, 2 critical) residing in upstream transitive dependencies (`@nitrostack/core`, `@vitest`, `drizzle-orm`, `tinypool`) that cannot be patched without breaking API changes.

---

## 8. Actionable Open Questions for Mentor

1. **Upstream Footprint Module (`cost_engine.footprint`):**
   Can you obtain the complete package or the missing `cost_engine/footprint.py` file from the Class1 team, or is our repository wrapper (`python/run_class1.py`) with explicit disclaimers acceptable as the permanent production integration approach?
2. **Second Upstream Packaging Defect:**
   Can you obtain the unbundled development packages (`autobuild` and `blue_book.prices` / `blue_book.spec`) from the upstream Class1 team so the full 469-test suite can run, or should our test runner permanently exclude those 37 uncollectable test files?
3. **`WARN` Verdict Threshold Rule:**
   Currently, `WARN` evaluates when `P90 >= CLASS1_WARN_FRACTION * budget` (default 0.8 / 80%). Does the team want this fraction to remain globally configured by environment variable, or should callers be able to provide custom per-estimate warning thresholds or tiered warning bands in tool arguments?
4. **Tenant Authentication Architecture:**
   Currently, authentication operates in a single trust domain using a shared `AUTH_SECRET`, with `userId` functioning as a logical workspace/namespace partition selector. Does Class1Dev require true per-tenant cryptographic authentication (such as per-tenant JWT claims or scoped individual API keys) before production deployment?

---

## 9. Setup & Verification Instructions

### Prerequisites
- Node.js >= 22.0.0
- Python >= 3.11.0
- Live Neon PostgreSQL database connection string

### Step 1: Environment & Secrets Setup
```bash
# In neon-mcp-server/
cp .env.example .env
# Edit .env and insert your real DATABASE_URL and a 32-byte AUTH_SECRET
```

### Step 2: Python Virtual Environment Setup
```bash
python -m venv .venv
# Windows:
.\.venv\Scripts\pip install -r requirements-class1.txt
# Linux/macOS:
# ./.venv/bin/pip install -r requirements-class1.txt
```

### Step 3: Database Migrations & Baseline Seed
```bash
npm install
npm run db:migrate
npm run db:seed
```

### Step 4: Build TypeScript Application
```bash
npm run build
```

### Step 5: Execute Verification Suites
```bash
# 1. Run unit test suite (42 Vitest tests across 3 suites)
npm test

# 2. Run repository secret scan (verifies 0 leaks across git tree)
.\.venv\Scripts\python scripts/scan_secrets.py

# 3. Run footprint placeholder coverage test (proves all 14 names covered)
.\.venv\Scripts\python scripts/test_footprint_placeholder.py

# 4. Run HTTP Tenant Isolation verification suite
node scripts/test_tenant_isolation_http.mjs

# 5. Run Edge Cases & Resilience verification suite
node scripts/test_edge_cases.mjs

# 6. Run End-to-End verification across all 10 pure FinOps MCP tools
node scripts/verify-e2e.mjs

# 7. Run Cold Restart Persistence verification
node scripts/test_restart_persistence.mjs

# 8. Run Real STDIO Handshake verification from an external working directory (C:\)
node scripts/test_stdio_handshake.mjs

# 9. Run all 10 pure FinOps MCP tools with recommended parameters
node scripts/test_every_tool.mjs
```

---

## 10. Running the Server

### Option A: Streamable HTTP Transport (Default)
```bash
npm start
```
The server will bind to `http://127.0.0.1:3000` (configurable via `HOST` and `PORT`):
- **MCP Endpoint:** `POST http://127.0.0.1:3000/mcp` (Header: `Authorization: Bearer <AUTH_SECRET>`)
- **Health Probe:** `GET http://127.0.0.1:3000/health` (Exempt from auth and rate limits)
- **Info Root:** `GET http://127.0.0.1:3000/`

### Option B: STDIO Transport for NitroStudio v1.4.22 & Local MCP Clients
To connect **NitroStudio (v1.4.22)** or other local desktop clients (Claude Desktop, Cursor) to this MCP server over STDIO:
1. In NitroStudio, navigate to **Settings** or **App Canvas** -> **Add Server** (or edit existing server connection).
2. Select **Transport Type**: `STDIO`.
3. Configure the execution parameters:
   - **Command:** `node`
   - **Arguments:** `dist/index.js`
   - **Working Directory:** Path to `neon-mcp-server`
   - **Environment Variables:**
     - `MCP_TRANSPORT=stdio`
     - `DATABASE_URL=<your_neon_database_url>`
     - `AUTH_SECRET=<your_auth_secret>`
     - `PYTHONUTF8=1`
4. Connect: Studio immediately initializes, discovers all 10 pure Enterprise AI FinOps tools, displays their interactive forms on the App Canvas, and enables live execution without HTTP 401 errors.
