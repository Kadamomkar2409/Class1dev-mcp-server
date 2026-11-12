# Class1Dev Neon PostgreSQL MCP Server

> **Production-Ready Model Context Protocol (MCP) Server for Class1Dev AI Cost Governance**  
> *Built with the official NitroStack TypeScript SDK (`@nitrostack/core`), Neon PostgreSQL, and the Real Class1 Cost-Risk Takeoff Engine*  
> *LOCAL IMPLEMENTATION SPECIFICATION & OPERATIONAL GUIDE*

---

## 1. Project Overview & Architectural Scope

This repository provides a production-grade, locally verified Model Context Protocol (MCP) server engineered for **Class1Dev**. It integrates pre-merge AI cost-risk modeling with persistent cloud storage in **Neon PostgreSQL**, powered natively by the **NitroStack TypeScript SDK (`@nitrostack/core`)** and the **real upstream Class1 cost-risk takeoff engine (`class1==0.1.0`)**.

### Scope & Constraints (Local Scope)
- **Local Implementation Only:** Runs locally over standard **Streamable HTTP** on `localhost:3000` via `POST /mcp`, `GET /health`, and `GET /`. Tested directly using `curl` and the official MCP Inspector. No NitroCloud edge routing or ChatGPT-specific dispatcher adapters.
- **Real Class1 Takeoff Engine:** Fully integrated real Python cost engine executing stochastic Monte Carlo simulations and AST static code analysis. Zero synthetic, hardcoded, or invented numbers in completed features.
- **Persistent Cloud Database:** Neon Serverless PostgreSQL storing users, cost estimate records, and tamper-resistant audit logs via Drizzle ORM.
- **Ten Tools:** The 8 core PRD database/telemetry tools plus 2 Class1 engine tools (`estimate_pr_cost` and `get_cost_verdict`).
- **Strict Security & Sanitization:** Zero secret leakage (`DATABASE_URL`, `AUTH_SECRET`, `CLASS1_LICENSE_KEY` masked across logs, errors, and git history). Parameterized SQL queries (no string concatenation), safe `child_process.spawn` argument arrays (no shell strings), constant-time authentication, rate limiting, and size-bounded request bodies.

---

## 2. End-to-End System Architecture

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          LOCAL SYSTEM ARCHITECTURE & DATA FLOW                         │
├──────────────────────────┬─────────────────────────────────────────────────────────────┤
│ LAYER                    │ RESPONSIBILITIES & PROTOCOLS                                │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ MCP Client               │ curl / MCP Inspector / Claude Code / Cursor                 │
│                          │ Protocol: JSON-RPC 2.0 over Streamable HTTP (POST /mcp)     │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ HTTP & Security Ingress  │ Express 4.x Server on port 3000                             │
│                          │ - Constant-time Bearer token verification (timingSafeEqual) │
│                          │ - Rate Limiting: 60 req/min on /mcp (Exempts GET /health)   │
│                          │ - Body limit: 1 MB cap (HTTP 413 Payload Too Large)         │
│                          │ - Sanitized Error Boundary (masks DB credentials/paths)     │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ MCP Protocol Layer       │ @nitrostack/core McpServer + StreamableHTTPServerTransport │
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
│   ├── test_footprint_placeholder.py # Proves all 14 footprint symbols covered
│   ├── test_restart_persistence.mjs  # Proves cold restart data persistence
│   ├── test_tenant_isolation.ts      # Service-level tenant isolation test
│   ├── test_tenant_isolation_http.mjs# Live HTTP /mcp tenant isolation test
│   └── verify-e2e.mjs         # End-to-end verification of all 10 tools
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
│   │       └── class1.tools.ts  # Controller registering all 10 MCP tools
│   ├── services/
│   │   ├── class1-engine.service.ts # Subprocess manager for Class1 engine
│   │   ├── health.service.ts        # Database connection & latency probe
│   │   └── record.service.ts        # Business logic, tenant scoping & audit logs
│   ├── tools/
│   │   └── schemas.ts         # Zod schemas and TypeScript types for all 10 tools
│   └── utils/
│       └── error-handler.ts   # Error sanitization and secret masking utilities
├── tests/
│   └── tools.test.ts          # Vitest suite (23 unit tests passing)
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

### Multi-Tenant Isolation Model
1. **Identity Flow:** MCP over Streamable HTTP is a stateless protocol where the client connects using a server-wide Bearer secret. In this local model, the authenticated caller represents the primary tenant (`DEFAULT_USER_ID`: `00000000-0000-0000-0000-000000000001`).
2. **Default Scoping:** When a caller invokes `list_records`, `search_records`, `get_record`, or `get_database_stats` without supplying a `userId`, `RecordService.resolveTenantUserId()` automatically scopes the query to `DEFAULT_USER_ID`.
3. **Cross-Tenant Protection:** A tenant cannot read, update, or delete records belonging to another tenant (`userId`). Any attempt returns a clean "Record not found or permission denied" error. Cross-tenant reads can only occur if an administrator explicitly enables `ALLOW_CROSS_TENANT_READS=true` in `.env`.
4. **Audit Immutability:** Every operation records the effective `userId` into the `audit_logs` table.

### Denial-of-Service (DoS) and Memory Protection
- **Payload Size Ceiling:** Express body parser enforces a strict 1 MB cap (`express.json({ limit: '1mb' })`). Oversized payloads are immediately rejected with an HTTP 413 `Payload Too Large` JSON response before reaching business logic.
- **Rate Limiting:** In-memory sliding-window limiter blocks callers exceeding 60 req/min on `/mcp` with HTTP 429 `Too Many Requests`. Public diagnostic probes (`GET /health`) and CORS preflights (`OPTIONS`) are strictly exempt to guarantee monitoring uptime.
- **Engine Concurrency & Timeouts:** `Class1EngineService` uses an active execution semaphore restricting parallel engine runs to 2. Subprocesses are killed via `SIGKILL` if they exceed 30 seconds or emit > 5 MB.

---

## 6. Complete Tool Catalog (10 Tools)

### PRD Database & Telemetry Tools (8 Tools)
1. **`create_record`**: Creates a persistent AI cost governance record in Neon PostgreSQL.  
   - Inputs: `title` (string, req), `description` (string, opt), `metadata` (object, opt), `userId` (uuid, opt).
2. **`get_record`**: Retrieves a record by UUID. Enforces tenant isolation.  
   - Inputs: `id` (uuid, req), `userId` (uuid, opt).
3. **`list_records`**: Paginated list of records. Scoped to authenticated principal by default.  
   - Inputs: `limit` (int, opt), `offset` (int, opt), `sortBy` (enum, opt), `sortOrder` (enum, opt), `userId` (uuid, opt).
4. **`update_record`**: Updates title, description, or metadata of an existing record. Requires record ownership.  
   - Inputs: `id` (uuid, req), `title` (string, opt), `description` (string, opt), `metadata` (object, opt), `userId` (uuid, opt).
5. **`delete_record`**: Permanently removes a record from Neon PostgreSQL. Requires record ownership.  
   - Inputs: `id` (uuid, req), `userId` (uuid, opt).
6. **`search_records`**: Case-insensitive substring search across titles and descriptions. Scoped to tenant.  
   - Inputs: `query` (string, req), `limit` (int, opt), `userId` (uuid, opt).
7. **`get_database_stats`**: Aggregated counts, storage volume, and activity stats from Neon PostgreSQL.  
   - Inputs: `userId` (uuid, opt).
8. **`get_system_status`**: Diagnostic telemetry including database latency, uptime, memory, and environment.  
   - Inputs: None.

### Real Class1 Takeoff Engine Tools (2 Tools)
9. **`estimate_pr_cost`**: Executes the real Class1 cost-risk takeoff engine on `beforeCode` and `afterCode`.  
   - Inputs:
     - `beforeCode` (string, 1–1,000,000 chars, req): Pre-change source code.
     - `afterCode` (string, 1–1,000,000 chars, req): Post-change source code.
     - `path` (string, req): Logical file path (e.g. `services/billing.py`).
     - `budgetP90Usd` (number, opt): Optional monthly P90 budget ceiling in USD.
     - `prNumber` (int, opt): Optional PR identifier.
     - `repo` (string, opt): Optional repository name.
     - `samples` (int, 1,000–120,000, opt): Monte Carlo simulation runs (default: 10,000).
     - `userId` (uuid, opt): Tenant owner.
   - Outputs: Stored `recordId`, three-state `verdict` (`BLOCK`, `WARN`, `PASS`, or `NO_BUDGET`), modeled `forecast` (expected, p50, p80, p90, p95, worst), AST delta, and full engine text report.
10. **`get_cost_verdict`**: Retrieves a previously evaluated Class1 cost estimate and governance verdict by UUID.  
    - Inputs: `id` (uuid, req), `userId` (uuid, opt).

---

## 7. Known Limitations & Upstream Advisories

1. **Footprint Module Missing Upstream (`cost_engine.footprint`):**
   - *Observation:* The upstream PyPI package `class1==0.1.0` (both wheel and sdist) does not ship the `cost_engine/footprint.py` module, despite `cost_engine/__init__.py` attempting to import 13 symbols from it.
   - *Workaround:* Resolved cleanly in our repository wrapper (`python/run_class1.py`) by registering a placeholder module in `sys.modules['cost_engine.footprint']` covering all 14 names (`CarbonPrice`, `resolve_intensity`, `carbon_kg`, `simulate_carbon`, `analyze_footprint_delta`, `load_grid`, `resolve_water`, `water_m3`, `simulate_water`, `analyze_water_delta`, `embodied_carbon_kg`, `materials_adp_kg`, `ewaste_kg_year`, `footprint_report`).
   - *Integrity:* Every placeholder function raises `NotImplementedError` or returns `None`. No synthetic numbers (carbon kg, water m³, e-waste) are ever returned or stored. The report displays: `"Ecological footprint: NOT COMPUTED (cost_engine.footprint is missing from class1 0.1.0)"`.
   - *Upstream Test Integrity:* The core takeoff and cost math test suite (`test_monte_carlo.py`, `test_scenario.py`, `test_contingency.py`, `test_escalation.py`, `test_policy_gate.py`, etc.) does not depend on footprint and passes completely (90 passed, 1 skipped).
2. **Pricing Snapshot Age:**
   - The pricing tables in `class1==0.1.0` (`snapshots/prices.json`) are from a static snapshot created approximately 159 days prior to evaluation. Modern models (e.g. `gpt-4.5-preview`) are absent and skipped by upstream tests.
3. **Class 5 Screening Accuracy:**
   - In accordance with AACE International cost engineering standards, estimates generated without calibrated company historical actuals are classified as **Class 5 (Screening)**, carrying an expected accuracy maturity band of **-50% to +100%**.
4. **Local Verdict Evaluation:**
   - In local mode, the approval verdict (`BLOCK`, `WARN`, `PASS`, `NO_BUDGET`) is evaluated by our TypeScript service layer based on the Monte Carlo P90 output, `budgetP90Usd`, and `CLASS1_WARN_FRACTION` (default: 0.8), rather than the proprietary upstream enterprise licensed policy gate.
5. **Docker Environment Status on Host:**
   - *Notice:* The local Windows host system does not have the Docker daemon or CLI installed (`docker` is not recognized). A hardened, multi-stage Debian Bookworm `Dockerfile` with pinned Python 3.11+, unprivileged `USER node`, and a curl `HEALTHCHECK` is provided in the repository root, but could not be built or executed on this host.

---

## 8. Setup & Verification Instructions

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
# 1. Run unit test suite (23 Vitest tests)
npm test

# 2. Run repository secret scan (verifies 0 leaks across git tree)
.\.venv\Scripts\python scripts/scan_secrets.py

# 3. Run footprint placeholder coverage test (proves all 14 names covered)
.\.venv\Scripts\python scripts/test_footprint_placeholder.py

# 4. Run HTTP Tenant Isolation verification suite
node scripts/test_tenant_isolation_http.mjs

# 5. Run Edge Cases & Resilience verification suite
node scripts/test_edge_cases.mjs

# 6. Run End-to-End verification across all 10 MCP tools
node scripts/verify-e2e.mjs

# 7. Run Cold Restart Persistence verification
node scripts/test_restart_persistence.mjs
```

---

## 9. Starting the Production Server

```bash
npm start
```
The server will bind to `http://localhost:3000`:
- **MCP Endpoint:** `POST http://localhost:3000/mcp` (Header: `Authorization: Bearer <AUTH_SECRET>`)
- **Health Probe:** `GET http://localhost:3000/health` (Exempt from auth and rate limits)
- **Info Root:** `GET http://localhost:3000/`
