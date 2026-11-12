import { describe, it, expect } from 'vitest';
import { EstimatePrCostSchema, GetCostVerdictSchema } from '../src/tools/schemas.js';
import { Class1EngineService } from '../src/services/class1-engine.service.js';

describe('Class1 MCP Tool Schemas', () => {
  it('should validate valid estimate_pr_cost input', () => {
    const valid = {
      beforeCode: 'import openai\nclient = openai.OpenAI()\n',
      afterCode: 'import openai\nclient = openai.OpenAI()\n# added retry\n',
      path: 'src/llm.py',
      budgetP90Usd: 5000.0,
      prNumber: 42,
      repo: 'acme/service',
      samples: 5000,
    };
    const parsed = EstimatePrCostSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('should reject estimate_pr_cost with empty beforeCode or afterCode', () => {
    expect(EstimatePrCostSchema.safeParse({ beforeCode: '', afterCode: 'x = 1', path: 'app.py' }).success).toBe(false);
    expect(EstimatePrCostSchema.safeParse({ beforeCode: 'x = 1', afterCode: '', path: 'app.py' }).success).toBe(false);
    expect(EstimatePrCostSchema.safeParse({ beforeCode: 'x = 1', afterCode: 'x = 2', path: '' }).success).toBe(false);
  });

  it('should enforce bounds on Monte Carlo samples (1,000 to 120,000)', () => {
    const tooLow = { beforeCode: 'a', afterCode: 'b', path: 'a.py', samples: 500 };
    expect(EstimatePrCostSchema.safeParse(tooLow).success).toBe(false);

    const tooHigh = { beforeCode: 'a', afterCode: 'b', path: 'a.py', samples: 200000 };
    expect(EstimatePrCostSchema.safeParse(tooHigh).success).toBe(false);

    const valid = { beforeCode: 'a', afterCode: 'b', path: 'a.py', samples: 10000 };
    expect(EstimatePrCostSchema.safeParse(valid).success).toBe(true);
  });

  it('should validate UUID on get_cost_verdict', () => {
    expect(GetCostVerdictSchema.safeParse({ id: '00000000-0000-0000-0000-000000000010' }).success).toBe(true);
    expect(GetCostVerdictSchema.safeParse({ id: 'invalid-id' }).success).toBe(false);
  });
});

describe('Class1 3-State Verdict Evaluation', () => {
  const service = new Class1EngineService();

  it('should return NO_BUDGET when no budget is provided', () => {
    expect(service.evaluateVerdict(6403.19, undefined, 0.8)).toBe('NO_BUDGET');
    expect(service.evaluateVerdict(6403.19, undefined)).toBe('NO_BUDGET');
  });

  it('should return BLOCK when P90 exceeds budget', () => {
    // P90 = 6403.19, budget = 5000.0 => BLOCK
    expect(service.evaluateVerdict(6403.19, 5000.0, 0.8)).toBe('BLOCK');
  });

  it('should return WARN when P90 is within warning threshold (>= warnFraction * budget)', () => {
    // P90 = 6403.19, budget = 7000.0, 0.8 * 7000 = 5600.0 => WARN
    expect(service.evaluateVerdict(6403.19, 7000.0, 0.8)).toBe('WARN');
  });

  it('should return PASS when P90 is well within budget (< warnFraction * budget)', () => {
    // P90 = 6403.19, budget = 10000.0, 0.8 * 10000 = 8000.0 => PASS
    expect(service.evaluateVerdict(6403.19, 10000.0, 0.8)).toBe('PASS');
  });

  it('should respect custom warnFraction', () => {
    // P90 = 6403.19, budget = 7000.0. If warnFraction = 0.95 (0.95 * 7000 = 6650) => PASS
    expect(service.evaluateVerdict(6403.19, 7000.0, 0.95)).toBe('PASS');
    // If warnFraction = 0.7 (0.7 * 7000 = 4900) => WARN
    expect(service.evaluateVerdict(6403.19, 7000.0, 0.7)).toBe('WARN');
  });
});

describe('Class1 Real Engine Integration (sample diff)', () => {
  const service = new Class1EngineService();

  const sampleBefore = [
    'import openai',
    '',
    'def analyze_text(text: str):',
    '    response = openai.chat.completions.create(',
    '        model="gpt-4o-mini",',
    '        messages=[{"role": "user", "content": text}],',
    '        max_tokens=500',
    '    )',
    '    return response.choices[0].message.content',
  ].join('\n');

  const sampleAfter = [
    'import openai',
    '',
    'def analyze_text(text: str):',
    '    response = openai.chat.completions.create(',
    '        model="gpt-4o",',
    '        messages=[{"role": "user", "content": text}],',
    '        max_tokens=2000',
    '    )',
    '    return response.choices[0].message.content',
  ].join('\n');

  it('should run real Class1 engine, extract numbers from JSON, and disclaim footprint', async () => {
    const result = await service.estimate({
      beforeCode: sampleBefore,
      afterCode: sampleAfter,
      path: 'app.py',
      budgetP90Usd: 7000.0,
      samples: 10000,
    });

    expect(result.verdict).toBe('WARN');
    expect(result.budgetP90Usd).toBe(7000.0);
    expect(result.impact).toBe('high');

    // Forecast numbers from real engine JSON output
    expect(result.forecast.expected).toBeGreaterThan(2500);
    expect(result.forecast.expected).toBeLessThan(4000);
    expect(result.forecast.p50).toBeGreaterThan(1500);
    expect(result.forecast.p90).toBeGreaterThan(5000);
    expect(result.forecast.p90).toBeLessThan(8000);
    expect(result.forecast.worst).toBeGreaterThan(20000);
    expect(result.forecast.estimateClass).toBe('Class 5 (Screening)');

    // Text report checks: footprint must be explicitly disclaimed and NOT computed
    expect(result.reportText).toContain('Ecological footprint: NOT COMPUTED (cost_engine.footprint is missing from class1 0.1.0)');

    // No footprint metrics stored in numerical forecast
    const forecastKeys = Object.keys(result.forecast);
    expect(forecastKeys).not.toContain('carbon');
    expect(forecastKeys).not.toContain('water');
    expect(forecastKeys).not.toContain('materials');
  }, 45000);
});

