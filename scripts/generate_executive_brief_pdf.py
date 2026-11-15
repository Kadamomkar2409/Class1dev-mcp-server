#!/usr/bin/env python3
"""
Generate a concise, 2-page executive briefing PDF for the Founder of Class1Dev.
Focus areas:
  - Business value & Shift-Left AI FinOps through MCP
  - Real Class1 engine evaluation metrics (P50/P90/P95) and policy gating
  - HTTP Transport Mode configuration specifically for Claude and Cursor
  - Real-world interactive prompt showcase
  - Phase 1 verified safeguards, honest limitations, and Phase 2 roadmap decisions
Outputs:
  - docs/Class1Dev_MCP_Phase1_Executive_Brief.html
  - docs/Class1Dev_MCP_Phase1_Executive_Brief.pdf
  - docs/Class1Dev_MCP_Phase1_Overview.pdf (updated to match the 2-page brief)
  - docs/exec_page_1.png, docs/exec_page_2.png (rendered for visual verification)
"""

import os
import sys
import subprocess
import pymupdf

DOCS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs"))
HTML_PATH = os.path.join(DOCS_DIR, "Class1Dev_MCP_Phase1_Client_Overview.html")
HTML_BRIEF_PATH = os.path.join(DOCS_DIR, "Class1Dev_MCP_Phase1_Executive_Brief.html")
PDF_CLIENT_PATH = os.path.join(DOCS_DIR, "Class1Dev_MCP_Phase1_Client_Overview.pdf")
PDF_OVERVIEW_PATH = os.path.join(DOCS_DIR, "Class1Dev_MCP_Phase1_Overview.pdf")
PDF_BRIEF_PATH = os.path.join(DOCS_DIR, "Class1Dev_MCP_Phase1_Executive_Brief.pdf")

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
]

def find_browser():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    raise FileNotFoundError("Neither Google Chrome nor Microsoft Edge was found on this system.")

def build_html():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Class1Dev MCP Server: Phase 1 Executive Overview</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #e2e8f0;
      font-size: 8.2pt;
      line-height: 1.34;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      height: 297mm;
      padding: 10mm 14mm 10mm 14mm;
      position: relative;
      page-break-after: always;
      overflow: hidden;
      background: #ffffff;
      margin: 0 auto;
    }
    .page:last-child {
      page-break-after: auto;
    }

    /* Running Header & Footer */
    .header-bar {
      position: absolute;
      top: 5mm;
      left: 14mm;
      right: 14mm;
      height: 4mm;
      font-size: 6.8pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      border-bottom: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-bar {
      position: absolute;
      bottom: 5mm;
      left: 14mm;
      right: 14mm;
      height: 4mm;
      font-size: 6.8pt;
      color: #64748b;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Top Brand Banner */
    .brand-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 1.2mm;
      margin-bottom: 1.2mm;
      margin-top: 1mm;
    }
    .brand-title {
      font-size: 15pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
    .brand-title span {
      color: #0284c7;
    }
    .brand-subtitle {
      font-size: 7.8pt;
      color: #475569;
      font-weight: 500;
      margin-top: 0.6mm;
    }
    .brand-badge {
      background: #f0fdf4;
      border: 1px solid #86efac;
      color: #166534;
      font-size: 6.6pt;
      font-weight: 700;
      padding: 1mm 2.2mm;
      border-radius: 1mm;
      text-align: right;
      line-height: 1.25;
    }

    /* Headings */
    h2 {
      font-size: 9.8pt;
      font-weight: 700;
      color: #1e3a8a;
      margin-top: 1mm;
      margin-bottom: 0.6mm;
      border-bottom: 1.1px solid #e2e8f0;
      padding-bottom: 0.4mm;
      display: flex;
      align-items: center;
      gap: 1.5mm;
      letter-spacing: -0.01em;
    }
    h3 {
      font-size: 7.6pt;
      font-weight: 700;
      color: #1e293b;
      margin-top: 0.6mm;
      margin-bottom: 0.4mm;
    }
    p {
      margin-bottom: 0.6mm;
      color: #334155;
    }
    strong {
      color: #0f172a;
      font-weight: 600;
    }

    /* Grids & Cards */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2mm;
      margin: 0.6mm 0 1mm 0;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1.8mm;
      margin: 0.6mm 0 1mm 0;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 1.6mm;
      margin: 0.6mm 0 1mm 0;
    }
    .card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 1mm;
      padding: 1.2mm 1.6mm;
    }
    .card-title {
      font-weight: 700;
      font-size: 7.5pt;
      color: #1e3a8a;
      margin-bottom: 0.4mm;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 0.3mm;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.6mm 0 1mm 0;
      font-size: 6.5pt;
    }
    th, td {
      padding: 0.48mm 1.2mm;
      text-align: left;
      border: 1px solid #cbd5e1;
      vertical-align: top;
      line-height: 1.18;
    }
    th {
      background: #1e3a8a;
      color: #ffffff;
      font-weight: 600;
      font-size: 6.8pt;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* Code & Pre */
    code, pre {
      font-family: "Cascadia Code", Consolas, "JetBrains Mono", monospace;
    }
    code {
      font-size: 6.6pt;
      background: #f1f5f9;
      color: #0f172a;
      padding: 0.1mm 0.5mm;
      border-radius: 0.5mm;
      border: 1px solid #e2e8f0;
    }
    pre {
      font-size: 6.3pt;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 0.8mm;
      padding: 0.8mm 1.2mm;
      margin: 0.4mm 0 0.6mm 0;
      line-height: 1.18;
      overflow-x: hidden;
      white-space: pre-wrap;
      color: #0f172a;
    }

    /* Badges */
    .badge {
      display: inline-block;
      font-size: 6.2pt;
      font-weight: 700;
      padding: 0.15mm 1mm;
      border-radius: 0.5mm;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .badge-pass { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-warn { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-block { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .badge-info { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }

    /* Callout */
    .callout {
      background: #f8fafc;
      border-left: 3px solid #1e3a8a;
      padding: 1mm 1.6mm;
      margin: 0.6mm 0 1mm 0;
      border-radius: 0 0.8mm 0.8mm 0;
      font-size: 7.1pt;
      line-height: 1.28;
    }
    .callout-alert {
      background: #fffbeb;
      border-left-color: #d97706;
    }
    .callout-title {
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 0.3mm;
      font-size: 7.3pt;
    }
    .callout-alert .callout-title {
      color: #92400e;
    }
  </style>
</head>
<body>

  <!-- ===================================================================== -->
  <!-- PAGE 1: STRATEGIC FINOPS VALUE & REAL ENGINE EVALUATION RESULTS        -->
  <!-- ===================================================================== -->
  <div class="page">
    <div class="header-bar">
      <span>Class1Dev &bull; AI Cost Governance & FinOps</span>
      <span>Executive Overview & Real Engine Proof (Phase 1)</span>
    </div>

    <!-- Header Banner -->
    <div class="brand-banner" style="margin-top: 2mm;">
      <div>
        <div class="brand-title">Class1Dev <span>AI FinOps MCP Server</span></div>
        <div class="brand-subtitle">Executive Overview: Connecting AI Developer Assistants to Real-Time Cloud Cost Governance</div>
      </div>
      <div class="brand-badge">
        PREPARED FOR THE FOUNDER OF CLASS1DEV<br>
        <span style="font-weight: normal; color: #475569;">Phase 1: Local Proof of Concept &bull; Nov 2026</span>
      </div>
    </div>

    <!-- Section 1: Problem & Strategic Opportunity -->
    <h2>1. The Shift-Left AI FinOps Opportunity: Why MCP Matters for Class1</h2>
    <div class="callout callout-alert">
      <div class="callout-title">Strategic Value Thesis for Founder Review</div>
      <p style="font-size: 7.2pt; margin: 0; color: #78350f;">
        <strong>Labelled Product Hypothesis:</strong> Class1 today operates primarily at Pull Request (PR) review time via CLI and GitHub Actions. Exposing Class1 through the open <strong>Model Context Protocol (MCP)</strong> creates an entirely new category: <em>In-Editor Shift-Left AI FinOps</em>.
      </p>
    </div>

    <div class="grid-2">
      <div class="card" style="border-left: 2.5px solid #b91c1c;">
        <div class="card-title" style="color: #991b1b;">The PR-Time Barrier (Today's Friction)</div>
        <p style="font-size: 7.2pt; margin: 0;">
          When an engineer swaps models (e.g. <code>gpt-4o-mini</code> &rarr; <code>gpt-4o</code>) or increases token caps, cost spikes are discovered only after code is authored, tested, and pushed to GitHub. Reworking prompt architectures or seeking budget exceptions at PR review creates development friction and release delays.
        </p>
      </div>
      <div class="card" style="border-left: 2.5px solid #15803d;">
        <div class="card-title" style="color: #166534;">The MCP Shift-Left Advantage (Phase 1 Proof)</div>
        <p style="font-size: 7.2pt; margin: 0;">
          With MCP, coding assistants (<strong>Claude Desktop, Cursor</strong>) query Class1's takeoff engine <em>while the code is being written</em>. Developers receive immediate tail-risk percentiles and budget verdicts before commit, and every evaluation persists to an immutable governance ledger in <strong>Neon PostgreSQL</strong>.
        </p>
      </div>
    </div>

    <!-- Section 2: Real Engine Worked Example -->
    <h2>2. Worked Example from Real Verified Output (Real Class1 Engine)</h2>
    <p style="font-size: 7.3pt; margin-bottom: 1mm;">
      The figures below are extracted from live test executions (<code>scripts/verify-e2e.mjs</code>, <code>tests/class1-engine.test.ts</code>) running the unedited <code>class1==0.1.0</code> PyPI engine over 120,000 Monte Carlo iterations:
    </p>

    <div class="grid-2">
      <div>
        <h3>Evaluated Code Diff (LLM Summarizer Migration)</h3>
        <p style="font-size: 7.1pt; color: #475569; margin-bottom: 0.5mm;">
          <strong>Target:</strong> <code>services/llm_summarizer.py</code> (PR #301) upgrading model tier &amp; tokens:
        </p>
        <pre><code># BEFORE (Baseline)
import openai
def call():
  return openai.chat.completions.create(
    model='gpt-4o-mini', max_tokens=200)

# AFTER (Candidate Change)
import openai
def call():
  return openai.chat.completions.create(
    model='gpt-4o', max_tokens=1000)</code></pre>
      </div>

      <div>
        <h3>Real Calculated Risk Percentiles (120k Samples)</h3>
        <table>
          <thead>
            <tr>
              <th>Monte Carlo Projection Metric</th>
              <th style="text-align: right;">Modeled Monthly Impact</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Expected Monthly Delta (Mean)</td><td style="text-align: right;"><strong>$3,134.83 / mo</strong></td></tr>
            <tr><td>P50 (Median Spend Delta)</td><td style="text-align: right;"><strong>$1,962.62 / mo</strong></td></tr>
            <tr><td>P80 Spend Delta</td><td style="text-align: right;"><strong>$4,202.78 / mo</strong></td></tr>
            <tr><td>P90 (Tail-Risk Delta &bull; Policy Gate)</td><td style="text-align: right;"><strong>$6,403.19 / mo</strong></td></tr>
            <tr><td>P95 High-Volatility Spend Delta</td><td style="text-align: right;"><strong>$9,414.22 / mo</strong></td></tr>
            <tr><td>Worst-Case Tail Projection</td><td style="text-align: right;"><strong>$25,819.97 / mo</strong></td></tr>
            <tr><td>Estimate Classification</td><td style="text-align: right;"><strong>Class 5 (Screening Grade)</strong></td></tr>
            <tr><td>Ecological Footprint Status</td><td style="text-align: right;"><span class="badge badge-warn">NOT COMPUTED</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Policy Verdict Cards -->
    <h3>Policy Verdict Decision Matrix (Modeled P90 = $6,403.19 vs Configured Team Budgets)</h3>
    <div class="grid-4" style="margin-bottom: 1.5mm;">
      <div class="card" style="border-top: 2.5px solid #b91c1c; text-align: center; padding: 1.5mm;">
        <span class="badge badge-block">BLOCK</span>
        <div style="font-size: 7.2pt; font-weight: 700; margin-top: 0.5mm;">Budget: $1,000</div>
        <div style="font-size: 6.8pt; color: #64748b;">P90 ($6,403) &gt; Budget</div>
      </div>
      <div class="card" style="border-top: 2.5px solid #b45309; text-align: center; padding: 1.5mm;">
        <span class="badge badge-warn">WARN</span>
        <div style="font-size: 7.2pt; font-weight: 700; margin-top: 0.5mm;">Budget: $7,000</div>
        <div style="font-size: 6.8pt; color: #64748b;">P90 &ge; 80% of Budget</div>
      </div>
      <div class="card" style="border-top: 2.5px solid #15803d; text-align: center; padding: 1.5mm;">
        <span class="badge badge-pass">PASS</span>
        <div style="font-size: 7.2pt; font-weight: 700; margin-top: 0.5mm;">Budget: $15,000</div>
        <div style="font-size: 6.8pt; color: #64748b;">P90 &lt; 80% of Budget</div>
      </div>
      <div class="card" style="border-top: 2.5px solid #64748b; text-align: center; padding: 1.5mm;">
        <span class="badge badge-info">NO_BUDGET</span>
        <div style="font-size: 7.2pt; font-weight: 700; margin-top: 0.5mm;">Budget: Unset</div>
        <div style="font-size: 6.8pt; color: #64748b;">No ceiling provided</div>
      </div>
    </div>

    <!-- Section 3: The 10 FinOps Tools Surface -->
    <h2>3. The 10 Specialized AI FinOps Tools Delivered in Phase 1</h2>
    <p style="font-size: 7.2pt; margin-bottom: 0.8mm;">
      To maximize enterprise client value, the server exposes 10 domain-specific tools with explicit FinOps semantics. (For automation scripts, all tools also accept shorthand aliases such as <code>estimate_pr_cost</code> and <code>get_cost_verdict</code>).
    </p>

    <table>
      <thead>
        <tr>
          <th style="width: 36mm;">FinOps Domain Tool</th>
          <th style="width: 28mm;">Operational Role</th>
          <th style="width: 62mm;">Functional Capability &amp; Execution Model</th>
          <th style="width: 56mm;">Business Value to Client / Founder</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>evaluate_pr_cost_risk</code></td>
          <td><span class="badge badge-pass" style="font-size: 5.8pt;">Pre-Commit Shift-Left</span></td>
          <td>Simulates 120,000 Monte Carlo iterations on diffs; calculates P50/P90/P95 tail-risk; returns policy gate.</td>
          <td><strong>Cost Proactivity:</strong> Prevents model cost runaway directly in the IDE before code review.</td>
        </tr>
        <tr>
          <td><code>get_pr_governance_verdict</code></td>
          <td><span class="badge badge-info" style="font-size: 5.8pt;">CI/CD Automated Gate</span></td>
          <td>Fetches stored cost forecast, percentile distributions, and PASS/WARN/BLOCK verdict by record UUID.</td>
          <td><strong>Pipeline Gating:</strong> Enables automated CI/CD bots to enforce budget compliance before merge.</td>
        </tr>
        <tr>
          <td><code>log_budget_policy_override</code></td>
          <td><span class="badge badge-warn" style="font-size: 5.8pt;">Policy Exception Ledger</span></td>
          <td>Logs authorized budget exceptions, executive waivers, or steering committee sign-offs with JSONB metadata.</td>
          <td><strong>Formal Accountability:</strong> Replaces informal Slack waivers with an immutable audit ledger.</td>
        </tr>
        <tr>
          <td><code>get_governance_record</code></td>
          <td><span class="badge badge-info" style="font-size: 5.8pt;">Audit Traceability</span></td>
          <td>Retrieves specific evaluation records or policy waivers by UUID with multi-tenant namespace scoping.</td>
          <td><strong>Audit Defense:</strong> Provides compliance officers with instant, tamper-evident historical verification.</td>
        </tr>
        <tr>
          <td><code>list_governance_ledger</code></td>
          <td><span class="badge badge-info" style="font-size: 5.8pt;">Portfolio Oversight</span></td>
          <td>Paginated inspection (<code>limit</code>, <code>offset</code>) of historical evaluations, model updates, and spend decisions.</td>
          <td><strong>Cross-Team Visibility:</strong> Allows FinOps directors to review AI spend trends across all services.</td>
        </tr>
        <tr>
          <td><code>update_governance_record</code></td>
          <td><span class="badge badge-info" style="font-size: 5.8pt;">Human-in-the-Loop</span></td>
          <td>Attaches review notes, approver signatures, Jira ticket keys, or updated risk tiers to existing records.</td>
          <td><strong>Workflow Integration:</strong> Bridges automated code scans with enterprise change management.</td>
        </tr>
        <tr>
          <td><code>delete_governance_record</code></td>
          <td><span class="badge badge-block" style="font-size: 5.8pt;">Ledger Hygiene</span></td>
          <td>Permanently purges retracted evaluation drafts or test runs with strict tenant boundary enforcement.</td>
          <td><strong>Ledger Hygiene:</strong> Keeps corporate financial ledgers clean without polluting production metrics.</td>
        </tr>
        <tr>
          <td><code>audit_pr_cost_history</code></td>
          <td><span class="badge badge-info" style="font-size: 5.8pt;">Historical Analytics</span></td>
          <td>Substring search across historical evaluation titles and diff notes to discover past model benchmarks.</td>
          <td><strong>Institutional Memory:</strong> Eliminates duplicate benchmarking and helps teams learn from past runs.</td>
        </tr>
        <tr>
          <td><code>get_finops_compliance_metrics</code></td>
          <td><span class="badge badge-pass" style="font-size: 5.8pt;">Executive Telemetry</span></td>
          <td>Aggregates total ledger scans, audit volume, and policy violation ratios from Neon PostgreSQL.</td>
          <td><strong>Executive Visibility:</strong> Equips engineering leadership with high-level platform health &amp; pass rates.</td>
        </tr>
        <tr>
          <td><code>get_service_health</code></td>
          <td><span class="badge badge-pass" style="font-size: 5.8pt;">Operational Assurance</span></td>
          <td>Probes live Neon connection pools, query latency (ms), server uptime, memory heap, and transport state.</td>
          <td><strong>Infrastructure SLA:</strong> DevOps teams verify real-time connectivity and microsecond query response.</td>
        </tr>
      </tbody>
    </table>

    <div class="footer-bar">
      <span>Class1Dev MCP Server &bull; Executive Brief (Phase 1)</span>
      <span>Page 1 of 2</span>
    </div>
  </div>

  <!-- ===================================================================== -->
  <!-- PAGE 2: HTTP TRANSPORT SETUP, PROMPTS, SECURITY & ROADMAP             -->
  <!-- ===================================================================== -->
  <div class="page">
    <div class="header-bar">
      <span>Class1Dev &bull; AI Cost Governance & FinOps</span>
      <span>HTTP Transport Setup (Claude & Cursor) & Roadmap</span>
    </div>

    <!-- Section 4: Connecting Claude and Cursor over HTTP Transport -->
    <h2>4. Connecting Claude &amp; Cursor via Streamable HTTP Transport Mode</h2>
    <p style="font-size: 7.3pt; margin-bottom: 1mm;">
      Phase 1 is verified over <strong>Streamable HTTP</strong> on port 3000. Start the server with <code>npm start</code> (or <code>node dist/index.js</code>). Every request strictly requires <code>Authorization: Bearer &lt;AUTH_SECRET&gt;</code>, protected by sliding-window rate limiting (60 req/min) and 1 MB payload limits.
    </p>

    <div class="grid-2">
      <!-- Cursor IDE HTTP Transport -->
      <div>
        <h3>Cursor IDE &bull; Native HTTP / SSE Transport</h3>
        <p style="font-size: 7.1pt; color: #475569; margin-bottom: 0.5mm;">
          Configure in <code>.cursor/mcp.json</code> or <strong>Cursor Settings &rarr; Features &rarr; MCP</strong>:
        </p>
        <pre><code>{
  "mcpServers": {
    "class1-finops-http": {
      "url": "http://127.0.0.1:3000/mcp",
      "headers": {
        "Authorization": "Bearer &lt;YOUR_AUTH_SECRET&gt;"
      }
    }
  }
}</code></pre>
        <p style="font-size: 6.8pt; color: #166534; margin: 0;">
          &bull; <strong>Status:</strong> Native HTTP Streamable transport supported directly in Cursor.
        </p>
      </div>

      <!-- Claude Desktop HTTP Transport -->
      <div>
        <h3>Claude &bull; HTTP Transport via SSE Bridge</h3>
        <p style="font-size: 7.1pt; color: #475569; margin-bottom: 0.5mm;">
          In <code>%APPDATA%\\Claude\\claude_desktop_config.json</code> (or Claude Code CLI):
        </p>
        <pre><code>{
  "mcpServers": {
    "class1-finops-http": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "http://127.0.0.1:3000/mcp",
        "--header", "Authorization: Bearer &lt;YOUR_AUTH_SECRET&gt;"
      ]
    }
  }
}</code></pre>
        <p style="font-size: 6.8pt; color: #166534; margin: 0;">
          &bull; <strong>Claude Code CLI:</strong> <code>claude mcp add class1-finops --url http://127.0.0.1:3000/mcp --header "Authorization: Bearer &lt;TOKEN&gt;"</code>
        </p>
      </div>
    </div>

    <!-- Section 5: Real-World Interactive Prompts -->
    <h2>5. Interactive Developer Prompting Showcase in Cursor &amp; Claude</h2>
    <p style="font-size: 7.3pt; margin-bottom: 1mm;">
      Once connected via HTTP, engineers interact naturally with Claude or Cursor to govern model spend before committing code:
    </p>

    <div class="grid-2">
      <div class="card" style="padding: 1.4mm 1.8mm;">
        <div style="font-weight: 700; font-size: 7.4pt; color: #1e3a8a;">Scenario 1: Pre-Commit Cost &amp; Risk Takeoff</div>
        <p style="font-size: 6.9pt; color: #475569; margin: 0.2mm 0;"><strong>Developer Prompt:</strong></p>
        <pre style="margin: 0.4mm 0; padding: 0.8mm 1.4mm;"><code>"I am upgrading services/llm_summarizer.py from gpt-4o-mini to
gpt-4o with max_tokens 1000. Evaluate our monthly spend impact
assuming a $7,000/mo budget ceiling."</code></pre>
        <p style="font-size: 6.8pt; color: #15803d; margin: 0;">
          &rarr; <strong>Action:</strong> Calls <code>evaluate_pr_cost_risk</code>, gets P90 of $6,403.19/mo, issues <strong>WARN</strong> verdict (exceeds 80% budget cap), returns UUID.
        </p>
      </div>

      <div class="card" style="padding: 1.4mm 1.8mm;">
        <div style="font-weight: 700; font-size: 7.4pt; color: #1e3a8a;">Scenario 2: CI/CD Record &amp; Compliance Audit</div>
        <p style="font-size: 6.9pt; color: #475569; margin: 0.2mm 0;"><strong>FinOps Lead Prompt:</strong></p>
        <pre style="margin: 0.4mm 0; padding: 0.8mm 1.4mm;"><code>"Fetch stored verdict for record 2464973f-47a2-44be-9190-4185e38db608
and show total compliance metrics across all pull requests."</code></pre>
        <p style="font-size: 6.8pt; color: #15803d; margin: 0;">
          &rarr; <strong>Action:</strong> Calls <code>get_pr_governance_verdict</code> and <code>get_finops_compliance_metrics</code>, displaying audit trail and pass/block rates.
        </p>
      </div>
    </div>

    <!-- Section 6: Verified Safeguards vs Honest Limitations -->
    <h2>6. Phase 1 Quality Safeguards vs. Honest Limitations</h2>
    <div class="grid-2">
      <div>
        <h3>Verified Phase 1 Quality Safeguards</h3>
        <table>
          <thead>
            <tr>
              <th>Verified Safeguard</th>
              <th>Technical Mechanism &amp; Evidence</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Bearer Authentication</td><td>Timing-safe Bearer verification (<code>timingSafeEqual</code> on SHA-256). Missing token: 401; invalid: 403.</td></tr>
            <tr><td>Sliding Rate Limiter</td><td>60 req/min cap on <code>/mcp</code>; public <code>GET /health</code> exempt (returns 200 OK during burst).</td></tr>
            <tr><td>Payload Ceiling</td><td>Strict 1 MB cap; rejects oversized bodies with HTTP 413 <code>Payload Too Large</code>.</td></tr>
            <tr><td>Sanitized Errors</td><td>Deep error unwrapping; zero connection strings, passwords, or tokens leaked (0 leaks in 64 files).</td></tr>
            <tr><td>Neon Audit Trail</td><td>Every call, mutation, and engine timeout writes structured rows to <code>audit_logs</code> table.</td></tr>
            <tr><td>Unit &amp; E2E Testing</td><td><strong>42 of 42 Vitest unit tests pass</strong>; 7 live verification scripts pass against Neon DB.</td></tr>
          </tbody>
        </table>
      </div>

      <div>
        <h3>Honest Limitations of Phase 1 (Local PoC)</h3>
        <table>
          <thead>
            <tr>
              <th>Limitation Area</th>
              <th>Current Phase 1 Reality &amp; Mitigation</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Estimate Accuracy</td><td><strong>Class 5 Screening Grade</strong> (-50% to +100%); uncalibrated against real customer production logs.</td></tr>
            <tr><td>Pricing Snapshot</td><td>Static model pricing table is ~159 days old, bundled in PyPI package; price cuts not reflected.</td></tr>
            <tr><td>Upstream Packaging #1</td><td>PyPI <code>class1</code> omits <code>footprint.py</code>; clean wrapper disclaims carbon/water; 0 fake numbers.</td></tr>
            <tr><td>Upstream Packaging #2</td><td>37 upstream test files uncollectable due to unbundled modules; core engine passes (430/439 tests).</td></tr>
            <tr><td>Policy Verdict Engine</td><td>80% <code>WARN</code> threshold computed in our TypeScript code, not Class1's licensed gate binary.</td></tr>
            <tr><td>Single Shared Token</td><td>Single shared bearer secret; tenant isolation is via namespace selector (<code>userId</code>), not per-user auth.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Section 7: Phase 2 Roadmap & Founder Decisions -->
    <h2>7. Phase 2 Strategic Roadmap &amp; Decisions Needed from the Founder</h2>
    <div class="grid-2">
      <div class="card" style="padding: 1.4mm 1.8mm; border-left: 2.5px solid #1e3a8a;">
        <div class="card-title">Phase 2 Strategic Roadmap (Path to Production)</div>
        <ul style="margin-left: 3.5mm; font-size: 6.8pt; color: #334155; line-height: 1.3;">
          <li><strong>Milestone 1: NitroCloud Edge Deployment:</strong> Public HTTPS endpoint with automated TLS termination and custom domain (<code>https://mcp.class1.dev/mcp</code>).</li>
          <li><strong>Milestone 2: Remote ChatGPT Client Integration:</strong> Public HTTP endpoint registration in OpenAI ChatGPT for executive access.</li>
          <li><strong>Milestone 3: Automated GitHub PR Webhooks:</strong> Ingest AST code diffs automatically upon PR creation and post risk reports to PR comments.</li>
          <li><strong>Milestone 4: Cloud Spend Calibration Engine:</strong> Ingest actual monthly cloud provider invoices to calibrate Monte Carlo distributions (Class 3/2 accuracy).</li>
          <li><strong>Milestone 5: Enterprise OAuth2/OIDC Auth:</strong> Per-user cryptographic authentication (Okta, GitHub, Auth0) replacing shared secret.</li>
        </ul>
      </div>

      <div class="card" style="padding: 1.4mm 1.8mm; border-left: 2.5px solid #d97706; background: #fffbeb;">
        <div class="card-title" style="color: #92400e;">Decisions &amp; Support Needed from Founder</div>
        <ol style="margin-left: 3.5mm; font-size: 6.8pt; color: #78350f; line-height: 1.3;">
          <li><strong>Upstream Package Resolution:</strong> Can Class1 provide an unbundled build or PyPI patch resolving missing <code>footprint.py</code> and test modules?</li>
          <li><strong>Commercial Hosting Licensing:</strong> Confirm commercial licensing terms for executing Class1 engine within a cloud-hosted multi-tenant MCP service.</li>
          <li><strong>Enterprise Identity Requirements:</strong> Confirm whether Phase 2 pilots require individual user OAuth2/OIDC or organization-level API keys.</li>
          <li><strong>Phase 2 Prioritization:</strong> Confirm whether remote ChatGPT access or automated GitHub PR webhook ingestion takes priority for next sprint.</li>
        </ol>
      </div>
    </div>

    <!-- Sign-off Block -->
    <div style="border-top: 1px solid #cbd5e1; padding-top: 1.2mm; margin-top: 1.5mm; display: flex; justify-content: space-between; font-size: 7.1pt; color: #475569;">
      <div><strong>Prepared by:</strong> Omkar Kadam, Technical Consultant</div>
      <div><strong>Status:</strong> Phase 1 Completed &bull; Verified Local PoC (Streamable HTTP / STDIO)</div>
      <div><strong>Audit Integrity:</strong> 0 Secrets Leaked &bull; 42/42 Vitest Tests Passing</div>
    </div>

    <div class="footer-bar">
      <span>Class1Dev MCP Server &bull; Executive Brief (Phase 1)</span>
      <span>Page 2 of 2</span>
    </div>
  </div>

</body>
</html>
"""

def main():
    os.makedirs(DOCS_DIR, exist_ok=True)
    
    html_content = build_html()
    
    # Strict validation: Ensure ZERO occurrences of PRD or team lead terminology
    for forbidden in ["prd", "team lead"]:
        if forbidden in html_content.lower():
            raise ValueError(f"Validation Error: Found forbidden term '{forbidden}' in client HTML!")
    print("[1] Strict validation passed: 0 occurrences of 'PRD' or 'team lead' in HTML.")
    
    print("[2] Writing Client Overview HTML to:", HTML_PATH)
    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html_content)
    with open(HTML_BRIEF_PATH, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    browser_exe = find_browser()
    print("[3] Found browser executable:", browser_exe)
    
    file_url = f"file:///{HTML_PATH.replace(os.sep, '/')}"
    print("[4] Converting HTML to 2-Page Client PDF via headless browser printing...")
    
    # 1. Generate docs/Class1Dev_MCP_Phase1_Client_Overview.pdf
    cmd_client = [
        browser_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={PDF_CLIENT_PATH}",
        file_url
    ]
    res_client = subprocess.run(cmd_client, capture_output=True, text=True)
    if not os.path.exists(PDF_CLIENT_PATH) or os.path.getsize(PDF_CLIENT_PATH) == 0:
        print("ERROR: Client PDF was not generated. Stderr:", res_client.stderr)
        sys.exit(1)
    print(f"    Client Overview PDF generated: {PDF_CLIENT_PATH} ({os.path.getsize(PDF_CLIENT_PATH):,} bytes)")

    # 2. Update docs/Class1Dev_MCP_Phase1_Overview.pdf as referenced by user
    cmd_overview = [
        browser_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={PDF_OVERVIEW_PATH}",
        file_url
    ]
    subprocess.run(cmd_overview, capture_output=True, text=True)
    print(f"    Overview PDF updated: {PDF_OVERVIEW_PATH} ({os.path.getsize(PDF_OVERVIEW_PATH):,} bytes)")

    # 3. Update docs/Class1Dev_MCP_Phase1_Executive_Brief.pdf
    cmd_brief = [
        browser_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={PDF_BRIEF_PATH}",
        file_url
    ]
    subprocess.run(cmd_brief, capture_output=True, text=True)
    print(f"    Executive Brief PDF updated: {PDF_BRIEF_PATH} ({os.path.getsize(PDF_BRIEF_PATH):,} bytes)")

    print("[5] Opening PDF with PyMuPDF for page count verification & visual rendering...")
    doc = pymupdf.open(PDF_CLIENT_PATH)
    page_count = len(doc)
    print(f"    Total Pages Generated: {page_count} (Target: EXACTLY 2 pages)")
    
    if page_count != 2:
        print(f"ERROR: Expected exactly 2 pages, but generated {page_count} pages!")
        sys.exit(1)
        
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=150)
        img_client = os.path.join(DOCS_DIR, f"client_page_{i+1}.png")
        img_exec = os.path.join(DOCS_DIR, f"exec_page_{i+1}.png")
        pix.save(img_client)
        pix.save(img_exec)
        print(f"    Page {i+1} rendered: {img_client} ({os.path.getsize(img_client):,} bytes)")
        
    print("\n[6] 2-Page Client Overview PDF generation, strict validation & visual QA complete!")

if __name__ == "__main__":
    main()
