/**
 * LogEnrichmentPipeline - Programmatic pipeline using PipelineBuilder
 *
 * Demonstrates PipelineBuilder with:
 * - addTransform, addValidate
 * - branch (conditional fork)
 * - parallel (concurrent transforms)
 * - catch (error recovery)
 */
import { PipelineBuilder } from '@hazeljs/data';

export const logEnrichmentPipeline = new PipelineBuilder('log-enrichment')
  .addTransform('normalize', (d: unknown) => {
    const obj = d as Record<string, unknown>;
    return {
      ...obj,
      level: String(obj.level ?? 'info').toLowerCase(),
      message: String(obj.message ?? '').trim(),
    };
  })
  .branch(
    'classify',
    (d) => (d as { level: string }).level === 'error',
    (b) =>
      b.addTransform('enrichError', (d: unknown) => {
        const obj = d as Record<string, unknown>;
        return {
          ...obj,
          severity: 'high',
          enrichedAt: new Date().toISOString(),
        };
      }),
    (b) =>
      b.addTransform('enrichInfo', (d: unknown) => {
        const obj = d as Record<string, unknown>;
        return {
          ...obj,
          severity: 'normal',
          enrichedAt: new Date().toISOString(),
        };
      })
  )
  .parallel('metadata', [
    (d: unknown) => {
      const obj = d as Record<string, unknown>;
      return { host: obj.host ?? 'unknown' };
    },
    (d: unknown) => {
      const obj = d as Record<string, unknown>;
      return { timestamp: obj.timestamp ?? new Date().toISOString() };
    },
  ])
  .addValidate('validate', (d: unknown) => d)
  .catch((data: unknown, err: Error) => ({
    ...(data as object),
    error: err.message,
    recovered: true,
  }));
