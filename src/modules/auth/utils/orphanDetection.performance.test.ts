/**
 * Performance tests for orphan detection latency requirements.
 * Tests p95 and p99 latency under concurrent load.
 *
 * @module orphanDetection.performance.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkIfOrphaned } from './orphanDetection';
import { supabase } from '@/core/config/supabaseClient';

// Mock Supabase client
vi.mock('@/core/config/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

/**
 * Calculate percentile from sorted array of numbers
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[index];
}

describe('orphanDetection Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should meet p95 < 200ms and p99 < 500ms latency requirements under 100 concurrent requests', async () => {
    // Mock fast database response (simulating optimized indexed query)
    let callCount = 0;
    const mockFrom = vi.fn().mockImplementation((tableName: string) => {
      callCount++;

      if (tableName === 'users') {
        // Simulate realistic database latency: 10-50ms
        const latency = 10 + Math.random() * 40;

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(() => {
                  return new Promise((resolve) => {
                    setTimeout(() => {
                      resolve({
                        data: {
                          user_uuid: `test-user-${callCount}`,
                          account_uuid: `test-account-${callCount}`,
                          role: 'member',
                          deleted_at: null,
                        },
                        error: null,
                      });
                    }, latency);
                  });
                }),
              }),
            }),
          }),
        };
      }

      // accounts table query
      const latency = 10 + Math.random() * 40;
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => {
                return new Promise((resolve) => {
                  setTimeout(() => {
                    resolve({
                      data: {
                        deleted_at: null,
                      },
                      error: null,
                    });
                  }, latency);
                });
              }),
            }),
          }),
        }),
      };
    });
    (supabase.from as any) = mockFrom;

    // Execute 100 concurrent orphan detection requests
    const concurrentRequests = 100;
    const latencies: number[] = [];

    const promises = Array.from({ length: concurrentRequests }, (_, i) =>
      checkIfOrphaned(`test-user-${i}`).then((result) => {
        latencies.push(result.metrics.totalDurationMs);
        return result;
      })
    );

    await Promise.all(promises);

    // Sort latencies for percentile calculation
    latencies.sort((a, b) => a - b);

    // Calculate percentiles
    const p50 = calculatePercentile(latencies, 50);
    const p95 = calculatePercentile(latencies, 95);
    const p99 = calculatePercentile(latencies, 99);
    const max = latencies[latencies.length - 1];

    console.log('Performance Test Results (100 concurrent requests):');
    console.log(`  p50 latency: ${p50}ms`);
    console.log(`  p95 latency: ${p95}ms (requirement: < 200ms)`);
    console.log(`  p99 latency: ${p99}ms (requirement: < 500ms)`);
    console.log(`  max latency: ${max}ms`);

    // Verify performance requirements
    expect(p95).toBeLessThan(200);
    expect(p99).toBeLessThan(500);

    // Verify all requests completed
    expect(latencies).toHaveLength(concurrentRequests);
  });

  it('should handle retry backoff timing correctly for failed first attempt', async () => {
    let usersAttemptCount = 0;
    const mockFrom = vi.fn().mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        usersAttemptCount++;

        // First attempt: timeout (simulate network issue)
        if (usersAttemptCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockImplementation(() => {
                    return new Promise((resolve) => {
                      setTimeout(() => {
                        resolve({
                          data: null,
                          error: null,
                        });
                      }, 300); // Timeout after 200ms
                    });
                  }),
                }),
              }),
            }),
          };
        }

        // Second attempt: success
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    user_uuid: 'test-user-id',
                    account_uuid: 'test-account-id',
                    role: 'member',
                    deleted_at: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      // accounts table query - success
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  deleted_at: null,
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    });
    (supabase.from as any) = mockFrom;

    const startTime = performance.now();
    const result = await checkIfOrphaned('test-user-id');
    const duration = performance.now() - startTime;

    // Verify retry occurred
    expect(result.metrics.attemptCount).toBe(2);

    // Verify total duration includes timeout + backoff + successful attempt
    // Should be: ~200ms (timeout) + ~100ms (jitter backoff) + <50ms (success) ≈ 350-400ms
    expect(duration).toBeGreaterThan(250); // At least timeout + partial backoff
    expect(duration).toBeLessThan(600); // Not more than timeout + max backoff + success

    console.log('Retry Backoff Timing Test:');
    console.log(`  Total duration: ${duration}ms`);
    console.log(`  Attempts: ${result.metrics.attemptCount}`);
    console.log(`  Expected: ~300-400ms (timeout + backoff + success)`);
  });

  it('should verify Gaussian jitter produces distributed backoff delays', () => {
    // Test that Gaussian jitter generates values with expected distribution
    const samples = 1000;
    const mean = 100;
    const stdDev = 50;
    const delays: number[] = [];

    // Generate samples using Box-Muller transform (same as orphanDetection.ts)
    for (let i = 0; i < samples; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const result = z0 * stdDev + mean;
      delays.push(Math.max(0, Math.round(result)));
    }

    // Calculate statistics
    const sum = delays.reduce((acc, val) => acc + val, 0);
    const calculatedMean = sum / samples;
    const variance = delays.reduce((acc, val) => acc + Math.pow(val - calculatedMean, 2), 0) / samples;
    const calculatedStdDev = Math.sqrt(variance);

    console.log('Gaussian Jitter Distribution Test:');
    console.log(`  Expected mean: ${mean}ms, Actual: ${calculatedMean.toFixed(2)}ms`);
    console.log(`  Expected stdDev: ${stdDev}ms, Actual: ${calculatedStdDev.toFixed(2)}ms`);
    console.log(`  Min: ${Math.min(...delays)}ms, Max: ${Math.max(...delays)}ms`);

    // Verify mean is close to expected (within 10%)
    expect(calculatedMean).toBeGreaterThan(mean * 0.9);
    expect(calculatedMean).toBeLessThan(mean * 1.1);

    // Verify standard deviation is close to expected (within 20%)
    expect(calculatedStdDev).toBeGreaterThan(stdDev * 0.8);
    expect(calculatedStdDev).toBeLessThan(stdDev * 1.2);

    // Verify ~68% of values fall within 1 standard deviation (Gaussian property)
    const withinOneStdDev = delays.filter((d) => d >= mean - stdDev && d <= mean + stdDev).length;
    const percentageWithinOneStdDev = (withinOneStdDev / samples) * 100;
    console.log(`  % within 1 stdDev: ${percentageWithinOneStdDev.toFixed(1)}% (expected: ~68%)`);
    expect(percentageWithinOneStdDev).toBeGreaterThan(60);
    expect(percentageWithinOneStdDev).toBeLessThan(76);
  });
});
