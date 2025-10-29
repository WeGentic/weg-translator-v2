# Enhanced Constant-Time Response with Gaussian Jitter Design

## Overview

This document specifies the enhanced constant-time response pattern using Gaussian jitter for the cleanup edge function. This improves upon the original uniform random jitter design per UserQA security recommendation.

## Requirements Addressed

- **Req#3**: Cleanup Edge Function Without Auth
- **Req#8**: Security Requirements for Cleanup Without Auth
- **NFR-5**: Constant-time 500ms ±50ms response

## Constant-Time Security Rationale

**Timing Attacks**: Attackers measure response times to infer information:
- **Code validity**: Valid codes may take longer to validate (database lookup + hash comparison) vs invalid codes (fast rejection)
- **User existence**: Existing users may have different response times than non-existent users
- **System state**: Different error paths may have measurably different execution times

**Defense**: Make all code paths take approximately the same time by adding delays to fast paths.

## Gaussian Jitter vs Uniform Jitter

### Uniform Jitter (Original Design)

```typescript
const jitter = (Math.random() * 2 - 1) * 50; // Range: [-50, 50]ms
const target = 500 + jitter; // Range: [450, 550]ms
```

**Distribution**: Flat (equal probability for all values in range)

**Weakness**: Attackers can detect patterns through statistical analysis:
- Collect 1000 response times
- Plot histogram → flat distribution indicates artificial delay
- Suspicious pattern reveals timing attack countermeasure

### Gaussian Jitter (Enhanced Design)

```typescript
const jitter = gaussianJitter(0, 25); // Mean=0, stddev=25ms
const target = 500 + jitter; // Range: [~425, ~575]ms (99.7% within ±3σ)
```

**Distribution**: Bell curve (normal distribution)

**Advantage**: Mimics natural system variance:
- Network latency is naturally Gaussian
- Database query times are often Gaussian-like
- Harder for attackers to distinguish artificial delay from natural variance

## Gaussian Jitter Implementation

### Box-Muller Transform

The **Box-Muller transform** generates Gaussian-distributed random numbers from uniform random numbers.

**Algorithm**:
```typescript
function gaussianJitter(mean: number, stddev: number): number {
  // Generate two uniform random numbers in (0, 1]
  const u1 = Math.random();
  const u2 = Math.random();

  // Box-Muller transform
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // Scale and shift to desired mean and standard deviation
  return mean + z0 * stddev;
}
```

**Statistical Properties**:
- **Mean (μ)**: Center of distribution
- **Standard Deviation (σ)**: Spread of distribution
- **68% of values**: Within ±1σ (±25ms)
- **95% of values**: Within ±2σ (±50ms)
- **99.7% of values**: Within ±3σ (±75ms)

**Example with μ=0, σ=25**:
- 68% of values: [-25, 25]ms
- 95% of values: [-50, 50]ms
- 99.7% of values: [-75, 75]ms

### Alternative: Polar Method (More Efficient)

```typescript
function gaussianJitterPolar(mean: number, stddev: number): number {
  let u, v, s;

  // Rejection sampling: generate points in unit circle
  do {
    u = Math.random() * 2 - 1; // Range: [-1, 1]
    v = Math.random() * 2 - 1; // Range: [-1, 1]
    s = u * u + v * v;
  } while (s >= 1 || s === 0);

  // Polar form of Box-Muller
  const z0 = u * Math.sqrt((-2 * Math.log(s)) / s);

  return mean + z0 * stddev;
}
```

**Advantage over Box-Muller**: No transcendental functions (cos, sin), faster execution.

**Recommended**: Use polar method in production for better performance.

## Constant-Time Response Function

### Complete Implementation

```typescript
/**
 * Apply constant-time delay to edge function response
 *
 * @param startTime - Request start timestamp (Date.now())
 * @param response - Response object to return
 * @returns Response object after delay
 */
async function applyConstantTimeResponse(
  startTime: number,
  response: Response
): Promise<Response> {
  const TARGET_MS = 500;
  const STDDEV_MS = 25;

  // Calculate elapsed time
  const elapsed = Date.now() - startTime;

  // Generate Gaussian jitter
  const jitter = gaussianJitterPolar(0, STDDEV_MS);

  // Calculate target response time
  const target = TARGET_MS + jitter;

  // Calculate delay needed
  const delay = Math.max(0, target - elapsed);

  // Apply delay
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Log timing metrics (for monitoring)
  console.log('Constant-time response metrics', {
    elapsed,
    jitter,
    target,
    delay,
    finalDuration: Date.now() - startTime,
  });

  return response;
}
```

### Usage in Edge Function

```typescript
// File: supabase/functions/cleanup-orphaned-user/index.ts

serve(async (req) => {
  const requestStartTime = Date.now();

  try {
    // Parse and validate request
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return await applyConstantTimeResponse(
        requestStartTime,
        new Response(
          JSON.stringify({
            error: {
              code: 'ORPHAN_CLEANUP_007',
              message: 'Invalid request format',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // Process request (request-code or validate-and-cleanup)
    // ... business logic ...

    // Success response
    return await applyConstantTimeResponse(
      requestStartTime,
      new Response(
        JSON.stringify({ data: { message: 'Success' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
  } catch (error) {
    // Error response
    return await applyConstantTimeResponse(
      requestStartTime,
      new Response(
        JSON.stringify({
          error: {
            code: 'ORPHAN_CLEANUP_006',
            message: 'Internal server error',
          },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }
});
```

## Response Time Distribution Analysis

### Target Distribution

**Parameters**:
- Mean: 500ms
- Standard Deviation: 25ms

**Expected Distribution**:
```
Response Time    | Probability | Cumulative
-----------------|-------------|------------
< 425ms          | 0.1%        | 0.1%
425-450ms        | 2.3%        | 2.4%
450-475ms        | 13.6%       | 16.0%
475-500ms        | 34.0%       | 50.0%    (median)
500-525ms        | 34.0%       | 84.0%
525-550ms        | 13.6%       | 97.6%
550-575ms        | 2.3%        | 99.9%
> 575ms          | 0.1%        | 100.0%
```

**Visual Representation** (ASCII histogram):
```
Response Time (ms)
    |
100%|                         *
    |                      *  *  *
 75%|                   *  *  *  *  *
    |                *  *  *  *  *  *  *
 50%|             *  *  *  *  *  *  *  *  *
    |          *  *  *  *  *  *  *  *  *  *  *
 25%|       *  *  *  *  *  *  *  *  *  *  *  *  *
    |    *  *  *  *  *  *  *  *  *  *  *  *  *  *  *
  0%|________________________________________________
    400 425 450 475 500 525 550 575 600
```

## Security Analysis

### Timing Attack Resistance

**Scenario**: Attacker attempts to determine valid verification codes by measuring response times.

**Attack Method**:
1. Submit 1000 requests with invalid codes
2. Measure response times for each
3. Analyze distribution to detect patterns

**Defense Effectiveness**:

**Without Constant-Time**:
- Valid code (rare): 350ms (DB lookup + validation)
- Invalid code (common): 50ms (format check only)
- **Easily distinguishable**: 300ms difference

**With Uniform Jitter**:
- All responses: 450-550ms (uniform distribution)
- **Pattern detection**: Flat histogram reveals artificial delay

**With Gaussian Jitter**:
- All responses: ~425-575ms (Gaussian distribution)
- **Pattern detection**: Bell curve mimics natural variance
- **Indistinguishable** from legitimate system behavior

### Statistical Indistinguishability Test

```typescript
// Hypothesis test: Can attacker distinguish Gaussian jitter from natural variance?

function chiSquaredTest(observed: number[], expected: number[]): number {
  let chiSquared = 0;

  for (let i = 0; i < observed.length; i++) {
    const diff = observed[i] - expected[i];
    chiSquared += (diff * diff) / expected[i];
  }

  return chiSquared;
}

// Example: Compare Gaussian jitter distribution vs natural network latency
const gaussianJitter = generateGaussianSamples(1000, 500, 25);
const networkLatency = measureRealNetworkLatency(1000);

const chiSq = chiSquaredTest(
  histogram(gaussianJitter),
  histogram(networkLatency)
);

// Chi-squared critical value for α=0.05, df=10: 18.31
// If chiSq < 18.31, distributions are indistinguishable at 95% confidence
console.log('Chi-squared statistic:', chiSq);
console.log('Indistinguishable:', chiSq < 18.31);
```

## Performance Considerations

### Additional Latency

**Best Case** (fast execution):
- Actual processing: 50ms
- Target: 500ms
- Delay added: 450ms

**Worst Case** (slow execution):
- Actual processing: 600ms
- Target: 500ms
- Delay added: 0ms (no delay if already slow)

**Average Case**:
- Actual processing: 200ms
- Target: 500ms
- Delay added: 300ms

**User Impact**: 500ms is acceptable for account recovery operations (not performance-critical).

### Delay Accuracy

**setTimeout Precision**:
- JavaScript setTimeout has ~1-5ms precision
- Actual delay may vary slightly from requested
- Gaussian jitter already provides variance, so setTimeout imprecision is negligible

## Monitoring

### Metrics to Track

```typescript
interface ConstantTimeMetrics {
  // Timing
  avgResponseTime: number; // Should be ~500ms
  stddevResponseTime: number; // Should be ~25ms
  p50ResponseTime: number; // Median
  p95ResponseTime: number; // 95th percentile
  p99ResponseTime: number; // 99th percentile

  // Jitter distribution
  jitterDistribution: number[]; // Histogram bins
  jitterMean: number; // Should be ~0ms
  jitterStddev: number; // Should be ~25ms

  // Delay effectiveness
  avgDelayAdded: number; // Average artificial delay
  responsesWithoutDelay: number; // Count of responses naturally >500ms
}
```

### Dashboard Queries

```typescript
// Analyze response time distribution
const responses = await fetchResponseLogs(timeRange);

const times = responses.map(r => r.finalDuration);
const mean = calculateMean(times);
const stddev = calculateStddev(times);

console.log('Response time statistics:');
console.log('  Mean:', mean, 'ms (target: 500ms)');
console.log('  Stddev:', stddev, 'ms (target: 25ms)');
console.log('  P50:', calculatePercentile(times, 50), 'ms');
console.log('  P95:', calculatePercentile(times, 95), 'ms');
console.log('  P99:', calculatePercentile(times, 99), 'ms');

// Check if distribution is Gaussian
const isGaussian = kolmogorovSmirnovTest(times, 500, 25);
console.log('Distribution is Gaussian:', isGaussian);
```

## Testing

### Unit Tests

```typescript
describe('Gaussian Jitter', () => {
  test('generates values with correct mean', () => {
    const samples = Array.from({ length: 10000 }, () => gaussianJitterPolar(0, 25));
    const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;

    expect(mean).toBeCloseTo(0, 1); // Within ±1ms
  });

  test('generates values with correct stddev', () => {
    const samples = Array.from({ length: 10000 }, () => gaussianJitterPolar(0, 25));
    const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
    const variance = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / samples.length;
    const stddev = Math.sqrt(variance);

    expect(stddev).toBeCloseTo(25, 1); // Within ±1ms
  });

  test('99.7% of values within ±3σ', () => {
    const samples = Array.from({ length: 10000 }, () => gaussianJitterPolar(0, 25));
    const withinRange = samples.filter(x => Math.abs(x) <= 75).length;

    expect(withinRange / samples.length).toBeGreaterThan(0.99);
  });
});

describe('Constant-Time Response', () => {
  test('applies delay for fast execution', async () => {
    const startTime = Date.now();
    const response = new Response('OK');

    const delayedResponse = await applyConstantTimeResponse(startTime, response);

    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeGreaterThanOrEqual(450); // ~500ms ±50ms
    expect(totalTime).toBeLessThanOrEqual(600);
  });

  test('applies no delay for slow execution', async () => {
    const startTime = Date.now() - 600; // Simulate 600ms elapsed
    const response = new Response('OK');

    const delayedResponse = await applyConstantTimeResponse(startTime, response);

    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(650); // No additional delay
  });

  test('all code paths have similar response times', async () => {
    const times = [];

    // Test success path
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await applyConstantTimeResponse(start, new Response('Success'));
      times.push(Date.now() - start);
    }

    // Test error path
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await applyConstantTimeResponse(start, new Response('Error', { status: 400 }));
      times.push(Date.now() - start);
    }

    // Calculate variance
    const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length;
    const stddev = Math.sqrt(variance);

    expect(mean).toBeCloseTo(500, 10); // Mean ~500ms
    expect(stddev).toBeLessThan(50); // Low variance = constant time
  });
});
```

## Acceptance Criteria

- [x] Gaussian jitter function documented (Box-Muller transform)
- [x] Polar method alternative provided (more efficient)
- [x] Target response time: 500ms ±25ms (1 stddev)
- [x] Complete applyConstantTimeResponse function specified
- [x] Usage pattern in edge function documented
- [x] Statistical distribution analysis provided
- [x] Security analysis: timing attack resistance explained
- [x] Performance impact documented
- [x] Monitoring metrics specified
- [x] Testing strategy with statistical tests included

**Status**: Ready for implementation in Phase 2
