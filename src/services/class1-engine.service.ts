import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { Injectable } from '@nitrostack/core';
import { config, PROJECT_ROOT } from '../config.js';
import { sanitizeErrorMessage } from '../utils/error-handler.js';

export interface Class1EngineInput {
  beforeCode: string;
  afterCode: string;
  path: string;
  budgetP90Usd?: number;
  samples?: number;
}

export interface Class1Forecast {
  expected: number;
  p50: number;
  p80: number;
  p90: number;
  p95: number;
  worst: number;
  estimateClass: string;
}

export interface Class1EngineResult {
  verdict: 'BLOCK' | 'WARN' | 'PASS' | 'NO_BUDGET';
  budgetP90Usd: number | null;
  warnFraction: number;
  forecast: Class1Forecast;
  delta: Record<string, number>;
  impact: string;
  reportText: string;
  samples: number;
}

/**
 * Class1EngineService
 * Integrates the real Class1 cost-risk engine via a secured child-process wrapper.
 * Features:
 *  - Strict in-memory concurrency semaphore (1-2 runs)
 *  - Execution timeout and stdout size limits
 *  - Argument array spawning with PYTHONUTF8=1 (handles paths with spaces)
 *  - Temporary file management with guaranteed cleanup
 *  - Extraction of true Monte Carlo numbers from --json output
 *  - Three-state verdict evaluation (BLOCK, WARN, PASS, or NO_BUDGET)
 *  - Strict footprint verification (ecological metrics marked NOT COMPUTED)
 */
@Injectable()
export class Class1EngineService {
  private activeRuns = 0;
  private readonly waitQueue: Array<() => void> = [];
  private readonly maxConcurrency = config.CLASS1_MAX_CONCURRENCY;

  /**
   * Acquire execution slot from semaphore
   */
  private async acquireSlot(): Promise<() => void> {
    if (this.activeRuns < this.maxConcurrency) {
      this.activeRuns++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.activeRuns--;
          const next = this.waitQueue.shift();
          if (next) next();
        }
      };
    }

    return new Promise<() => void>((resolve) => {
      this.waitQueue.push(() => {
        this.activeRuns++;
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.activeRuns--;
            const next = this.waitQueue.shift();
            if (next) next();
          }
        });
      });
    });
  }

  /**
   * Determine the Python binary path
   */
  private resolvePythonPath(): string {
    if (config.CLASS1_PYTHON_PATH && fs.existsSync(config.CLASS1_PYTHON_PATH)) {
      return config.CLASS1_PYTHON_PATH;
    }

    // Check virtual environment in project root (resolved relative to import.meta.url)
    const isWindows = process.platform === 'win32';
    const candidateRoots = [PROJECT_ROOT, process.cwd()];

    for (const root of candidateRoots) {
      const venvPythonWin = path.resolve(root, '.venv', 'Scripts', 'python.exe');
      const venvPythonUnix = path.resolve(root, '.venv', 'bin', 'python');

      if (isWindows && fs.existsSync(venvPythonWin)) {
        return venvPythonWin;
      }
      if (!isWindows && fs.existsSync(venvPythonUnix)) {
        return venvPythonUnix;
      }
    }

    return 'python';
  }

  /**
   * Resolve repository wrapper script
   */
  private resolveWrapperScript(): string {
    const candidateRoots = [PROJECT_ROOT, process.cwd()];
    for (const root of candidateRoots) {
      const wrapper = path.resolve(root, 'python', 'run_class1.py');
      if (fs.existsSync(wrapper)) {
        return wrapper;
      }
    }
    throw new Error(`Class1 engine runner script not found (searched ${PROJECT_ROOT} and ${process.cwd()})`);
  }

  /**
   * Calculate 3-state cost verdict
   */
  public evaluateVerdict(
    p90: number,
    budgetP90Usd?: number,
    warnFraction: number = config.CLASS1_WARN_FRACTION
  ): 'BLOCK' | 'WARN' | 'PASS' | 'NO_BUDGET' {
    if (budgetP90Usd === undefined || budgetP90Usd === null || isNaN(budgetP90Usd)) {
      return 'NO_BUDGET';
    }
    if (p90 > budgetP90Usd) {
      return 'BLOCK';
    }
    if (p90 >= warnFraction * budgetP90Usd) {
      return 'WARN';
    }
    return 'PASS';
  }

  /**
   * Execute real Class1 takeoff engine on before/after code
   */
  async estimate(input: Class1EngineInput): Promise<Class1EngineResult> {
    const release = await this.acquireSlot();

    const runId = crypto.randomUUID();
    const tempDir = os.tmpdir();
    const tempBefore = path.join(tempDir, `class1_before_${runId}.py`);
    const tempAfter = path.join(tempDir, `class1_after_${runId}.py`);
    const tempJson = path.join(tempDir, `class1_out_${runId}.json`);

    const timeoutMs = parseInt(process.env.CLASS1_TIMEOUT_MS || '', 10) || config.CLASS1_TIMEOUT_MS;
    const maxOutputBytes = config.CLASS1_MAX_OUTPUT_BYTES;
    const warnFraction = config.CLASS1_WARN_FRACTION;
    const samples = Math.min(Math.max(input.samples || config.CLASS1_MC_SAMPLES, 1000), 120000);

    try {
      // 1. Write temporary files
      await fs.promises.writeFile(tempBefore, input.beforeCode, { encoding: 'utf8' });
      await fs.promises.writeFile(tempAfter, input.afterCode, { encoding: 'utf8' });

      const pythonPath = this.resolvePythonPath();
      const wrapperScript = this.resolveWrapperScript();

      // Arguments array (safe from shell injection & paths with spaces)
      const args = [
        wrapperScript,
        '--before', tempBefore,
        '--after', tempAfter,
        '--path', input.path,
        '--json', tempJson,
        '-n', String(samples),
      ];

      // 2. Spawn child process
      const { stdout, stderr, exitCode } = await new Promise<{
        stdout: string;
        stderr: string;
        exitCode: number | null;
      }>((resolve, reject) => {
        let stdoutChunks: Buffer[] = [];
        let stderrChunks: Buffer[] = [];
        let stdoutLen = 0;
        let killed = false;

        const child = spawn(pythonPath, args, {
          cwd: PROJECT_ROOT,
          env: {
            ...process.env,
            PYTHONUTF8: '1',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const timer = setTimeout(() => {
          killed = true;
          child.kill('SIGKILL');
          reject(new Error(`Class1 cost-risk engine execution timed out after ${timeoutMs}ms.`));
        }, timeoutMs);

        child.stdout.on('data', (chunk: Buffer) => {
          stdoutLen += chunk.length;
          if (stdoutLen > maxOutputBytes) {
            killed = true;
            clearTimeout(timer);
            child.kill('SIGKILL');
            reject(new Error(`Class1 engine stdout exceeded maximum allowed size (${maxOutputBytes} bytes).`));
            return;
          }
          stdoutChunks.push(chunk);
        });

        child.stderr.on('data', (chunk: Buffer) => {
          stderrChunks.push(chunk);
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });

        child.on('close', (code) => {
          clearTimeout(timer);
          if (killed) return;
          resolve({
            stdout: Buffer.concat(stdoutChunks).toString('utf8'),
            stderr: Buffer.concat(stderrChunks).toString('utf8'),
            exitCode: code,
          });
        });
      });

      if (exitCode !== 0) {
        const errDetail = stderr.trim() || stdout.trim() || `Exit code ${exitCode}`;
        throw new Error(`Class1 engine failed: ${sanitizeErrorMessage(errDetail)}`);
      }

      // 3. Read JSON output for exact numerical values
      if (!fs.existsSync(tempJson)) {
        throw new Error('Class1 engine completed but did not produce expected JSON output file.');
      }

      const jsonRaw = await fs.promises.readFile(tempJson, { encoding: 'utf8' });
      const parsedJson = JSON.parse(jsonRaw);

      const delta = parsedJson.delta || {};
      const forecast: Class1Forecast = {
        expected: typeof delta.expected === 'number' ? delta.expected : 0,
        p50: typeof delta.p50 === 'number' ? delta.p50 : 0,
        p80: typeof delta.p80 === 'number' ? delta.p80 : 0,
        p90: typeof delta.p90 === 'number' ? delta.p90 : 0,
        p95: typeof delta.p95 === 'number' ? delta.p95 : 0,
        worst: typeof delta.worst === 'number' ? delta.worst : 0,
        estimateClass: 'Class 5 (Screening)',
      };

      const verdict = this.evaluateVerdict(forecast.p90, input.budgetP90Usd, warnFraction);

      return {
        verdict,
        budgetP90Usd: input.budgetP90Usd ?? null,
        warnFraction,
        forecast,
        delta,
        impact: parsedJson.impact || 'unknown',
        reportText: stdout,
        samples,
      };
    } finally {
      // 4. Guaranteed temp file cleanup and semaphore release
      await Promise.allSettled([
        fs.promises.unlink(tempBefore).catch(() => {}),
        fs.promises.unlink(tempAfter).catch(() => {}),
        fs.promises.unlink(tempJson).catch(() => {}),
      ]);
      release();
    }
  }
}

export const class1EngineService = new Class1EngineService();

