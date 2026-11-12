# Class1Dev MCP Implementation Walkthrough & Engineering Handbook

> **Client:** Class1Dev AI Cost Governance  
> **Framework:** Official NitroStack TypeScript SDK (`@nitrostack/core`)  
> **Database:** Neon PostgreSQL (Serverless Connection Pool via Drizzle ORM)  
> **Cost-Risk Engine:** Real Upstream Class1 Takeoff Engine (`class1==0.1.0`)  
> **Scope:** Local Implementation over Streamable HTTP (Port 3000)

This handbook documents the internal architecture, security boundaries, and live verification evidence for the Class1Dev MCP server implementation.

---

## 1. Architectural Walkthrough

### 1.1 Request Lifecycle Over Streamable HTTP
1. **Client Ingress (`POST /mcp`)**: An MCP client (e.g. `curl`, MCP Inspector, or automated test script) sends a JSON-RPC 2.0 payload over HTTP.
2. **Rate Limiting Barrier**: `rateLimitMiddleware` evaluates the client IP. If requests exceed 60 req/min on `/mcp`, it responds with HTTP 429 (`Too Many Requests`). `GET /health` requests bypass this check.
3. **Payload Size Guard**: Body parsing is capped at 1 MB. Payloads exceeding this limit trigger an immediate HTTP 413 (`Payload Too Large`) response from `errorMiddleware`.
4. **Timing-Safe Authentication**: `authMiddleware` validates the `Authorization: Bearer <token>` header against `AUTH_SECRET` using `crypto.timingSafeEqual` over SHA-256 digests.
5. **Transport & Protocol Dispatch**: `StreamableHTTPServerTransport` (from `@nitrostack/core`) parses the JSON-RPC message, maps session headers, and dispatches to the corresponding tool handler.
6. **Zod Input Validation**: The tool's Zod schema validates parameters. Schema errors return formatted, sanitized JSON error responses without crashing.
7. **Service Execution**:
   - `RecordService`: Queries or updates Neon PostgreSQL via Drizzle ORM. Automatically resolves the tenant identity (`userId`), scoping to `DEFAULT_USER_ID` if omitted. Writes structured operational audit logs to `audit_logs`.
   - `Class1EngineService`: Spawns the real Python engine (`python/run_class1.py`) with argument arrays, `PYTHONUTF8=1`, a 30s timeout, a 5 MB buffer cap, and a concurrency semaphore (max 2 parallel runs).
8. **Response Envelope**: The tool returns structured data, which `@nitrostack/core` serializes into standard MCP content blocks (`{ content: [{ type: "text", text: ... }] }`).

---

## 2. Real Class1 Engine Integration & Upstream Patch Details

### 2.1 Upstream Package Anomaly
During Phase 3a engine discovery, inspecting the PyPI distribution (`class1==0.1.0.tar.gz` and wheel) revealed that `cost_engine/footprint.py` was omitted by the package authors, even though `cost_engine/__init__.py` attempted to import 13 names from it.

### 2.2 Clean Repository Wrapper (`python/run_class1.py`)
To maintain zero modifications to Python `site-packages`, the engine is invoked exclusively via `python/run_class1.py`. This wrapper safely injects a placeholder module into `sys.modules['cost_engine.footprint']` before importing `takeoff.estimate_pr`:
- Implements all 14 symbols: `CarbonPrice`, `resolve_intensity`, `carbon_kg`, `simulate_carbon`, `analyze_footprint_delta`, `load_grid`, `resolve_water`, `water_m3`, `simulate_water`, `analyze_water_delta`, `embodied_carbon_kg`, `materials_adp_kg`, `ewaste_kg_year`, and `footprint_report`.
- Every placeholder function either raises `NotImplementedError` or returns `None`.
- `footprint_report()` returns: `"Ecological footprint: NOT COMPUTED (cost_engine.footprint is missing from class1 0.1.0)"`.
- **Zero invented metrics:** No carbon, water, or material numbers are ever generated, displayed, or stored.
- Core cost math (`test_monte_carlo.py`, `test_scenario.py`, `test_escalation.py`, `test_policy_gate.py`) is 100% independent of footprint and passes upstream tests completely (90 passed, 1 skipped).

---

## 3. Step-by-Step Live Verification Walkthrough

### 3.1 Unit Testing (Vitest)
Executes 23 unit tests verifying all 10 tool schemas, Zod validation boundaries, parameter constraints, and error sanitization:
```bash
npm test
```
*Result:* 23 passed (100% test pass rate).

### 3.2 Secret Hygiene Scan
Verifies that no unmasked secrets appear in tracked files or working tree files:
```bash
.\.venv\Scripts\python scripts/scan_secrets.py
```
*Result:* 0 secrets leaked across 44 files.

### 3.3 HTTP Multi-Tenant Isolation
Verifies that tenant data remains strictly segregated over the real HTTP `/mcp` transport:
```bash
node scripts/test_tenant_isolation_http.mjs
```
*Key Assertions Verified:*
- Unspecified `userId` scopes automatically to `DEFAULT_USER_ID`.
- User A cannot `get_record`, `update_record`, `delete_record`, `list_records`, or `search_records` belonging to User B.
- User B retains full CRUD capabilities over their own records.
- Zero cross-tenant data leakage.

### 3.4 Edge Cases & Failure Modes
Verifies server stability under adversarial inputs and failure conditions:
```bash
node scripts/test_edge_cases.mjs
```
*Key Scenarios Verified:*
- `estimate_pr_cost` with budget < P90 -> returns `BLOCK`.
- `estimate_pr_cost` with high budget -> returns `PASS`.
- `estimate_pr_cost` with no budget -> returns `NO_BUDGET`.
- Invalid UUID format -> returns clean Zod validation error.
- Missing required fields -> returns clean Zod validation error.
- Empty code strings -> returns clean Zod validation error.
- Oversized payload (> 1 MB) -> returns HTTP 413 `Payload Too Large`.
- Subprocess timeout / failure simulation -> caught cleanly, process does not crash.
- `get_record` after deletion -> returns clean NOT FOUND.
- Rate limiting burst on `/mcp` -> returns HTTP 429 `Too Many Requests`.
- Diagnostic probe immediately following burst -> `GET /health` returns HTTP 200.

### 3.5 End-to-End Suite (10 MCP Tools)
Verifies full operational lifecycle across all 10 tools against live Neon PostgreSQL:
```bash
node scripts/verify-e2e.mjs
```
*Tools Covered:* `create_record`, `get_record`, `list_records`, `update_record`, `delete_record`, `search_records`, `get_database_stats`, `get_system_status`, `estimate_pr_cost`, and `get_cost_verdict`.

### 3.6 Cold Restart Data Persistence
Proves that database records and audit entries persist across server restarts:
```bash
node scripts/test_restart_persistence.mjs
```
*Result:* Records created prior to restart exist intact with identical UUIDs and metadata in Neon PostgreSQL.
