# HazelJS Data Starter

A comprehensive, real-world example demonstrating **@hazeljs/data** for data processing and ETL in Node.js. This starter implements production-ready pipelines with Schema validation, batch processing, data quality, and programmatic pipelines.

## Features

- **OrderProcessingPipeline** – E-commerce order ETL: normalize → validate → enrich (with conditional step for cancelled orders) → finalize
- **UserIngestionPipeline** – User profile ETL: normalize → validate → sanitize (with `@Redact` for PII)
- **LogEnrichmentPipeline** – Programmatic pipeline via PipelineBuilder: branch, parallel, catch
- **Schema validation** – Fluent Schema API (string, number, object, array, email, oneOf)
- **Batch processing** – Process arrays through pipelines via StreamService
- **Quality checks** – Completeness, notNull, uniqueness, range, referentialIntegrity via QualityService
- **Data profiling & anomaly detection** – `profile()` and `detectAnomalies()` endpoints
- **SchemaFaker & StreamProcessor** – Demonstrated in `npm run run:sample`
- **REST API** – Endpoints for pipeline execution, quality reports, profiling, and anomalies

## Quick Start

```bash
# Install dependencies (from hazeljs repo root - uses local packages via file:)
cd hazeljs-data-starter
npm install

# Or with published packages: replace file: deps in package.json with
# "@hazeljs/core": "^0.2.0-beta.63", "@hazeljs/data": "^0.2.0-beta.63"

# Build
npm run build

# Start the server
npm start

# Or run in dev mode with hot reload
npm run dev
```

The API runs at **http://localhost:3001**.

## Pipelines

### OrderProcessingPipeline

Processes e-commerce orders through:

1. **normalize** – Trim strings, lowercase status
2. **validate** – Schema validation (id, customerId, items, status, createdAt)
3. **enrich** – Add subtotal, tax (10%), total, processedAt

**Valid order schema:**
- `id`, `customerId` – required strings
- `items` – array of `{ sku, qty, price }` (sku min 1 char, qty ≥ 1, price ≥ 0)
- `status` – one of: pending, paid, shipped, delivered, cancelled
- `createdAt` – required string

### UserIngestionPipeline

Processes user profiles through:

1. **normalize** – Lowercase email, trim fields, clamp age
2. **validate** – Schema (email format, name length, age range, role)
3. **sanitize** – Remove internal fields, add ingestedAt

**Valid user schema:**
- `email` – valid email format
- `name` – 1–200 chars
- `age` – 0–150
- `role` – one of: user, admin, moderator, guest

## API Endpoints

### Process Single Order

```bash
curl -X POST http://localhost:3001/data/pipeline/orders \
  -H "Content-Type: application/json" \
  -d '{
    "id": "ord-001",
    "customerId": "cust-123",
    "items": [
      { "sku": "WIDGET-A", "qty": 2, "price": 29.99 }
    ],
    "status": "paid",
    "createdAt": "2025-02-20T10:00:00Z"
  }'
```

**Response:**
```json
{
  "result": {
    "id": "ord-001",
    "customerId": "cust-123",
    "items": [
      { "sku": "WIDGET-A", "qty": 2, "price": 29.99, "subtotal": 59.98 }
    ],
    "status": "paid",
    "total": 65.98,
    "tax": 6,
    "createdAt": "2025-02-20T10:00:00Z",
    "processedAt": "2025-02-23T12:00:00.000Z"
  }
}
```

### Batch Process Orders

```bash
curl -X POST http://localhost:3001/data/pipeline/orders/batch \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [
      { "id": "ord-001", "customerId": "c1", "items": [{ "sku": "A", "qty": 1, "price": 10 }], "status": "paid", "createdAt": "2025-01-01" },
      { "id": "ord-002", "customerId": "c2", "items": [{ "sku": "B", "qty": 2, "price": 5 }], "status": "pending", "createdAt": "2025-01-02" }
    ]
  }'
```

### Process Single User

```bash
curl -X POST http://localhost:3001/data/pipeline/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "name": "Alice Smith",
    "age": 28,
    "role": "user"
  }'
```

### Run Quality Checks

```bash
curl -X POST http://localhost:3001/data/quality \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "orders",
    "data": [
      { "id": "1", "customerId": "c1", "items": [], "status": "paid", "createdAt": "2025-01-01" }
    ]
  }'
```

### Process Log (PipelineBuilder)

```bash
curl -X POST http://localhost:3001/data/pipeline/logs \
  -H "Content-Type: application/json" \
  -d '{
    "level": "error",
    "message": "Connection timeout",
    "host": "api-01"
  }'
```

### Run Data Profiling

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

### Detect Anomalies

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

## Project Structure

```
hazeljs-data-starter/
├── src/
│   ├── index.ts                 # Bootstrap & server
│   ├── app.module.ts            # App module with DataModule
│   ├── pipelines/
│   │   ├── order-processing.pipeline.ts  # Order ETL (with conditional enrich)
│   │   ├── user-ingestion.pipeline.ts   # User ETL (with @Redact PII)
│   │   ├── log-enrichment.pipeline.ts   # PipelineBuilder (branch, parallel, catch)
│   │   └── index.ts
│   ├── controllers/
│   │   └── data.controller.ts   # REST API
│   ├── data/
│   │   ├── data.bootstrap.ts     # Quality checks (uniqueness, range, referentialIntegrity)
│   │   ├── sample-orders.json
│   │   └── sample-users.json
│   └── scripts/
│       └── run-sample-pipelines.ts  # CLI: pipelines, SchemaFaker, StreamProcessor
├── package.json
├── tsconfig.json
└── README.md
```

## Pipeline Implementation

Uses `@hazeljs/data` decorators:

```typescript
@Pipeline('order-processing')
@Injectable()
export class OrderProcessingPipeline extends PipelineBase {
  constructor(etlService: ETLService) {
    super(etlService);
  }

  @Transform({ step: 1, name: 'normalize' })
  async normalize(data: unknown): Promise<RawOrder> {
    // Normalize fields...
    return normalized;
  }

  @Validate({
    step: 2,
    name: 'validate',
    schema: OrderSchema,
  })
  async validate(data: unknown): Promise<RawOrder> {
    return data; // Validation runs automatically
  }

  @Transform({ step: 3, name: 'enrich' })
  async enrich(data: RawOrder): Promise<ProcessedOrder> {
    // Add computed fields...
    return enriched;
  }
}

// Usage: await pipeline.execute(rawOrder);
```

## Schema API

```typescript
import { Schema } from '@hazeljs/data';

const UserSchema = Schema.object({
  email: Schema.string().email(),
  name: Schema.string().min(1).max(200),
  age: Schema.number().min(0).max(150),
  role: Schema.string().oneOf(['user', 'admin']),
});
```

Available: `string()`, `number()`, `date()`, `object(shape)`, `array(itemSchema)` with `.min()`, `.max()`, `.email()`, `.uuid()`, `.oneOf()`.

## Programmatic Usage

Run pipelines without the HTTP server:

```bash
npm run run:sample
```

This loads `src/data/sample-orders.json` and `src/data/sample-users.json` and processes them through the pipelines.

## Extending to Production

1. **Flink integration** – Configure `DataModule.forRoot({ flink: { url: '...' } })` for stream deployment.
2. **@Stream pipelines** – Add `@Stream({ name, source, sink })` for Kafka/Flink-style streaming.
3. **PipelineBuilder** – See `log-enrichment.pipeline.ts` for branch, parallel, catch.
4. **TransformerService** – Use built-ins: `trimString`, `toLowerCase`, `parseJson`, `pick`, `omit`, `renameKeys`.
5. **Custom quality checks** – Register with `qualityService.registerCheck()`.
6. **PII decorators** – Use `@Mask`, `@Redact`, `@Encrypt` on pipeline steps.
7. **SchemaFaker** – Generate test data with `SchemaFaker.generate(schema)`.
8. **StreamProcessor** – Use `tumblingWindow`, `slidingWindow`, `sessionWindow`, `joinStreams` for streaming.

## Environment

Copy `.env.example` to `.env` and adjust:

```
PORT=3001
LOG_LEVEL=info

# Optional: Flink
# FLINK_REST_URL=http://localhost:8081
```

## License

Apache-2.0
