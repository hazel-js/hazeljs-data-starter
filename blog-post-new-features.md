# What's New in HazelJS Data: PipelineBuilder, PII Safety, and Advanced Quality

*A deep dive into the latest @hazeljs/data features—programmatic pipelines, conditional steps, PII decorators, profiling, and anomaly detection*

---

## Introduction

The [HazelJS Data Starter](https://github.com/hazel-js/hazeljs) has been updated with a host of new features that make ETL pipelines more expressive, safer, and easier to test. This post walks through each addition with code examples from the starter.

---

## 1. PipelineBuilder: Programmatic Pipelines

Not every pipeline needs decorators. Sometimes you want to compose transforms in code—branching on conditions, running steps in parallel, or recovering from errors. **PipelineBuilder** provides an immutable, fluent API for exactly that.

### LogEnrichmentPipeline

The starter includes [log-enrichment.pipeline.ts](https://github.com/hazel-js/hazeljs/blob/main/hazeljs-data-starter/src/pipelines/log-enrichment.pipeline.ts), a programmatic pipeline that demonstrates:

- **branch** – Fork based on log level (error vs info)
- **parallel** – Run multiple transforms concurrently and merge results
- **catch** – Recover from step failures instead of throwing

```typescript
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
    (b) => b.addTransform('enrichError', (d) => ({ ...d, severity: 'high', enrichedAt: new Date().toISOString() })),
    (b) => b.addTransform('enrichInfo', (d) => ({ ...d, severity: 'normal', enrichedAt: new Date().toISOString() }))
  )
  .parallel('metadata', [
    (d) => ({ host: (d as Record<string, unknown>).host ?? 'unknown' }),
    (d) => ({ timestamp: (d as Record<string, unknown>).timestamp ?? new Date().toISOString() }),
  ])
  .addValidate('validate', (d) => d)
  .catch((data, err) => ({ ...(data as object), error: err.message, recovered: true }));
```

### Try It

```bash
curl -X POST http://localhost:3001/data/pipeline/logs \
  -H "Content-Type: application/json" \
  -d '{"level": "error", "message": "Connection timeout", "host": "api-01"}'
```

**Response:**
```json
{
  "result": {
    "level": "error",
    "message": "Connection timeout",
    "host": "api-01",
    "severity": "high",
    "enrichedAt": "2025-03-06T12:00:00.000Z",
    "timestamp": "2025-03-06T12:00:00.000Z"
  }
}
```

---

## 2. Conditional Steps with `when`

Steps can now run only when a predicate returns true. The **OrderProcessingPipeline** uses this to skip enrichment for cancelled orders:

```typescript
@Transform({
  step: 3,
  name: 'enrich',
  when: (d) => (d as RawOrder).status !== 'cancelled',
})
async enrich(data: RawOrder): Promise<ProcessedOrder> {
  // Add subtotal, tax, total—only for non-cancelled orders
  // ...
}
```

A **finalize** step runs for all orders and adds `processedAt` (and default totals for cancelled orders). This keeps the pipeline flow clean while avoiding unnecessary computation.

---

## 3. PII Decorators: @Redact, @Mask, @Encrypt

Sensitive data should never leak into logs or downstream systems. **@hazeljs/data** provides PII decorators that run *before* the decorated method executes.

### @Redact

The **UserIngestionPipeline** uses `@Redact` to strip `internalId` from output:

```typescript
@Transform({ step: 3, name: 'sanitize' })
@Redact({ fields: ['internalId'] })
async sanitize(data: RawUser): Promise<ProcessedUser> {
  return {
    email: data.email ?? '',
    name: data.name ?? '',
    age: data.age ?? 0,
    role: data.role ?? 'user',
    ingestedAt: new Date().toISOString(),
  };
}
```

By the time `sanitize` runs, `internalId` has already been removed from the data. The method receives clean data and returns a safe `ProcessedUser`.

### @Mask and @Encrypt

- **@Mask** – Replaces field values with `****` (or a custom replacement). Use `showLast: 4` to reveal the last 4 characters (e.g. for card numbers).
- **@Encrypt** – AES-256-GCM encrypts specified fields. Use with **@Decrypt** when reading back.

---

## 4. Enhanced Quality Checks

The starter now registers more built-in checks in [data.bootstrap.ts](https://github.com/hazel-js/hazeljs/blob/main/hazeljs-data-starter/src/data/data.bootstrap.ts):

| Check | Purpose |
|-------|---------|
| **completeness** | Required fields present |
| **notNull** | No null/undefined in specified fields |
| **uniqueness** | No duplicate values in specified fields |
| **range** | Numeric values within min/max |
| **referentialIntegrity** | Values in allowed set (enum-like) |

Example registration:

```typescript
qualityService.registerCheck('order-uniqueness', qualityService.uniqueness(['id']));
qualityService.registerCheck('order-status-ref', qualityService.referentialIntegrity('status', [
  'pending', 'paid', 'shipped', 'delivered', 'cancelled',
]));
qualityService.registerCheck('user-age-range', qualityService.range('age', { min: 0, max: 150 }));
qualityService.registerCheck('user-role-ref', qualityService.referentialIntegrity('role', [
  'user', 'admin', 'moderator', 'guest',
]));
```

Quality reports include a **score 0–100** and per-check details.

---

## 5. Data Profiling

**QualityService.profile()** computes field-level statistics: null count, cardinality, min/max, mean, stddev, top values.

### Endpoint

```bash
curl -X POST http://localhost:3001/data/quality/profile \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "users",
    "data": [
      { "name": "Alice", "age": 28 },
      { "name": "Bob", "age": 35 },
      { "name": "Carol", "age": 42 }
    ]
  }'
```

**Response:**
```json
{
  "profile": {
    "dataset": "users",
    "totalRows": 3,
    "fields": {
      "name": {
        "count": 3,
        "nullCount": 0,
        "nullPct": 0,
        "uniqueCount": 3,
        "cardinality": 1,
        "topValues": [{"value": "Alice", "count": 1}, ...]
      },
      "age": {
        "count": 3,
        "nullCount": 0,
        "mean": 35,
        "stddev": 7,
        "min": 28,
        "max": 42,
        ...
      }
    },
    "generatedAt": "2025-03-06T12:00:00.000Z"
  }
}
```

---

## 6. Anomaly Detection

**QualityService.detectAnomalies()** flags rows where numeric fields deviate beyond a z-score threshold from the mean.

### Endpoint

```bash
curl -X POST http://localhost:3001/data/quality/anomalies \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      { "value": 10 },
      { "value": 11 },
      { "value": 12 },
      { "value": 1000 }
    ],
    "fields": ["value"],
    "threshold": 1.5
  }'
```

**Response:**
```json
{
  "anomalies": [
    {
      "field": "value",
      "rowIndex": 3,
      "value": 1000,
      "zScore": 2.89,
      "message": "Value 1000 is 2.89 stddev from mean"
    }
  ]
}
```

Use this for outlier detection in metrics, prices, or sensor data.

---

## 7. SchemaFaker: Generate Test Data

**SchemaFaker** generates fake data that conforms to a schema—useful for seeding tests and demos.

The [run-sample-pipelines](https://github.com/hazel-js/hazeljs/blob/main/hazeljs-data-starter/src/scripts/run-sample-pipelines.ts) script demonstrates it:

```typescript
import { Schema, SchemaFaker } from '@hazeljs/data';

const SimpleUserSchema = Schema.object({
  name: Schema.string(),
  age: Schema.number().min(0).max(150),
});
const fakeUsers = SchemaFaker.generateMany(SimpleUserSchema, 2);
// [{ name: "x7k2m", age: 42 }, { name: "abc12", age: 89 }]
```

Run `npm run run:sample` to see SchemaFaker output alongside pipeline results.

---

## 8. StreamProcessor: Windowing

**StreamProcessor** supports tumbling, sliding, and session windows, plus stream join. The sample script shows **tumblingWindow**:

```typescript
import { StreamProcessor } from '@hazeljs/data';

async function* timestampedSource() {
  yield { value: 1, timestamp: 100 };
  yield { value: 2, timestamp: 150 };
  yield { value: 3, timestamp: 250 };
}

const processor = new StreamProcessor(etlService);
for await (const batch of processor.tumblingWindow(timestampedSource(), 100)) {
  console.log(batch);
  // { items: [1, 2], windowStart: 100, windowEnd: 200 }
  // { items: [3], windowStart: 200, windowEnd: 300 }
}
```

Also available: **slidingWindow**, **sessionWindow**, **joinStreams**.

---

## 9. Pipeline Options: Retry, Timeout, DLQ

Decorator-based pipelines support per-step options:

| Option | Purpose |
|--------|---------|
| **when** | Run step only when predicate returns true |
| **retry** | Retry failed step with fixed or exponential backoff |
| **timeoutMs** | Abort step after N milliseconds |
| **dlq** | Route failed records to a handler instead of throwing |

Example:

```typescript
@Transform({
  step: 2,
  name: 'enrich',
  when: (d) => (d as { type: string }).type === 'order',
  retry: { attempts: 3, delay: 500, backoff: 'exponential' },
  timeoutMs: 5000,
  dlq: { handler: (item, err, step) => logger.error('DLQ', { item, err, step }) },
})
async enrich(data: unknown) {
  return { ...data, enriched: true };
}
```

---

## API Endpoints Summary

| Endpoint | Description |
|----------|-------------|
| `POST /data/pipeline/orders` | Process single order |
| `POST /data/pipeline/orders/batch` | Batch process orders |
| `POST /data/pipeline/users` | Process single user |
| `POST /data/pipeline/logs` | Process log (PipelineBuilder) |
| `POST /data/quality` | Run quality checks |
| `POST /data/quality/profile` | Run data profiling |
| `POST /data/quality/anomalies` | Detect anomalies |
| `GET /data/quality` | Quick quality check with sample data |

---

## Running the Starter

```bash
cd hazeljs-data-starter
npm install
npm run build
npm start
```

For programmatic execution (pipelines + SchemaFaker + StreamProcessor):

```bash
npm run run:sample
```

---

## Summary

The HazelJS Data Starter now showcases:

- **PipelineBuilder** – Branch, parallel, catch without decorators
- **Conditional steps** – `when` for skip logic
- **PII decorators** – @Redact, @Mask, @Encrypt for sensitive data
- **Enhanced quality** – Uniqueness, range, referentialIntegrity
- **Data profiling** – Field stats and top values
- **Anomaly detection** – Outlier flagging by z-score
- **SchemaFaker** – Test data generation
- **StreamProcessor** – Tumbling/sliding/session windows, join

These features make @hazeljs/data suitable for production ETL with robust validation, observability, and safety.

---

## Links and Resources

| Resource | URL |
|----------|-----|
| **HazelJS** | [https://hazeljs.com](https://hazeljs.com) |
| **HazelJS GitHub** | [https://github.com/hazel-js/hazeljs](https://github.com/hazel-js/hazeljs) |
| **@hazeljs/data on npm** | [https://www.npmjs.com/package/@hazeljs/data](https://www.npmjs.com/package/@hazeljs/data) |
| **Data package docs** | [https://hazeljs.com/docs/packages/data](https://hazeljs.com/docs/packages/data) |
| **HazelJS Data Starter** | [hazeljs-data-starter](https://github.com/hazel-js/hazeljs/tree/main/hazeljs-data-starter) |

---

*This blog post covers the new features added to the HazelJS Data Starter. For the original overview, see [blog-post.md](blog-post.md).*
