# Building Production ETL Pipelines in Node.js with HazelJS Data

*A comprehensive guide to the HazelJS Data Starter—decorator-based ETL, Schema validation, and data quality in TypeScript*

---

## Introduction

Data pipelines are the backbone of modern applications. Whether you're ingesting e-commerce orders, processing user profiles, or streaming events to analytics, you need reliable ETL (Extract, Transform, Load) with validation, quality checks, and a clean API.

[HazelJS](https://hazeljs.com) is a decorator-first Node.js framework that provides **@hazeljs/data**—a module for pipeline orchestration, Schema validation, batch and stream processing, and data quality. In this post, we'll walk through the [HazelJS Data Starter](https://github.com/hazel-js/hazeljs)—a real-world example with order processing, user ingestion, and quality checks.

---

## Why ETL in Node.js?

Node.js excels at I/O-bound workloads. ETL pipelines often involve:

- **REST APIs** receiving and responding to data
- **Database reads/writes** for persistence
- **Stream processing** for real-time events
- **Validation** before data enters your system

Keeping ETL in the same runtime as your API simplifies deployment, reduces latency, and lets you reuse TypeScript types and validation logic. [@hazeljs/data](https://www.npmjs.com/package/@hazeljs/data) provides decorators (`@Pipeline`, `@Transform`, `@Validate`, `@Stream`) and services ([ETLService](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/pipelines/etl.service.ts), [StreamService](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/pipelines/stream.service.ts), [QualityService](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/quality/quality.service.ts)) for exactly this pattern.

---

## What is @hazeljs/data?

[@hazeljs/data](https://www.npmjs.com/package/@hazeljs/data) extends [HazelJS](https://hazeljs.com) with:

| Component | Purpose |
|-----------|---------|
| **@Pipeline** | Mark classes as ETL pipelines with sequential step execution |
| **@Transform** | Data transformation steps with ordering |
| **@Validate** | Schema validation at specific steps |
| **@Stream** | Streaming pipelines for Kafka/Flink-style processing |
| **Schema** | Fluent validation API (string, number, object, array, email, oneOf) |
| **ETLService** | Executes pipeline steps sequentially |
| **StreamService** | Batch and stream processing |
| **QualityService** | Data quality checks (completeness, notNull, custom) |
| **PipelineBuilder** | Programmatic pipeline composition |
| **FlinkService** | Apache Flink job deployment (optional) |

You can explore the [Data package source](https://github.com/hazel-js/hazeljs/tree/main/packages/data) and the [HazelJS homepage](https://hazeljs.com) for the full API.

---

## Architecture of the HazelJS Data Starter

The [HazelJS Data Starter](https://github.com/hazel-js/hazeljs) implements two production-ready pipelines plus supporting infrastructure:

| Component | Responsibility |
|-----------|----------------|
| **OrderProcessingPipeline** | E-commerce order ETL: normalize → validate → enrich (subtotal, tax, total) |
| **UserIngestionPipeline** | User profile ETL: normalize → validate → sanitize |
| **DataModule** | Registers ETLService, StreamService, QualityService, and more |
| **DataController** | REST endpoints for pipeline execution and quality checks |
| **DataBootstrap** | Registers quality checks on startup |
| **SchemaValidator** | Validates data against [Schema](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/schema/schema.ts) definitions |

The [starter repository](https://github.com/hazel-js/hazeljs) includes sample data and a CLI script for programmatic execution.

---

## Getting Started

### Prerequisites

- Node.js 18+
- [HazelJS](https://hazeljs.com) and [@hazeljs/data](https://www.npmjs.com/package/@hazeljs/data) installed

### Installation

```bash
# Clone or navigate to the starter
cd hazeljs-data-starter

# Install dependencies
npm install

# Build
npm run build

# Start the server
npm start
```

The API is available at **http://localhost:3001**. For development with hot reload, use `npm run dev`. Full setup is in the [starter README](https://github.com/hazel-js/hazeljs/blob/main/README.md).

---

## The @Pipeline, @Transform, and @Validate Decorators

[@hazeljs/data](https://www.npmjs.com/package/@hazeljs/data) uses three core decorators to define ETL pipelines:

### @Pipeline

Marks a class as an ETL pipeline. Optionally provide a name for logging and introspection:

```typescript
@Pipeline('order-processing')
@Injectable()
export class OrderProcessingPipeline extends PipelineBase {
  // ...
}
```

The [Pipeline decorator source](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/decorators/pipeline.decorator.ts) shows the full options.

### @Transform

Marks a method as a transformation step. Steps run in order; output of step N feeds into step N+1:

```typescript
@Transform({ step: 1, name: 'normalize' })
async normalize(data: unknown): Promise<RawOrder> {
  // Trim, lowercase, type coercion
  return normalized;
}

@Transform({ step: 3, name: 'enrich' })
async enrich(data: RawOrder): Promise<ProcessedOrder> {
  // Add computed fields
  return enriched;
}
```

The [Transform decorator](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/decorators/transform.decorator.ts) defines the metadata used by [ETLService](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/pipelines/etl.service.ts).

### @Validate

Marks a step as validation. The [SchemaValidator](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/validators/schema.validator.ts) validates data against the provided schema before the method runs:

```typescript
@Validate({
  step: 2,
  name: 'validate',
  schema: OrderSchema,
})
async validate(data: unknown): Promise<RawOrder> {
  return data; // Validation happens automatically before this runs
}
```

The [Validate decorator](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/decorators/validate.decorator.ts) ties validation to the pipeline lifecycle.

---

## OrderProcessingPipeline Deep Dive

The [OrderProcessingPipeline](https://github.com/hazel-js/hazeljs/blob/main/hazeljs-data-starter/src/pipelines/order-processing.pipeline.ts) demonstrates a typical e-commerce ETL flow:

### Step 1: Normalize

Trim strings, lowercase status, ensure numeric types:

```typescript
@Transform({ step: 1, name: 'normalize' })
async normalize(data: unknown): Promise<RawOrder> {
  const raw = data as RawOrder;
  return {
    id: (raw.id ?? '').toString().trim(),
    customerId: (raw.customerId ?? '').toString().trim(),
    items: (raw.items ?? []).map((item) => ({
      sku: (item.sku ?? '').toString().trim(),
      qty: Math.max(0, Number(item.qty) || 0),
      price: Math.max(0, Number(item.price) || 0),
    })),
    status: (raw.status ?? 'pending').toString().toLowerCase().trim(),
    createdAt: (raw.createdAt ?? '').toString().trim(),
  };
}
```

### Step 2: Validate

[Schema](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/schema/schema.ts) ensures required fields and types:

```typescript
const OrderSchema = Schema.object({
  id: Schema.string().min(1),
  customerId: Schema.string().min(1),
  items: Schema.array(OrderItemSchema),
  status: Schema.string().oneOf(['pending', 'paid', 'shipped', 'delivered', 'cancelled']),
  createdAt: Schema.string().min(1),
});
```

### Step 3: Enrich

Add subtotal, tax (10%), total, and `processedAt`:

```typescript
@Transform({ step: 3, name: 'enrich' })
async enrich(data: RawOrder): Promise<ProcessedOrder> {
  const items = data.items.map((item) => ({
    ...item,
    subtotal: item.qty * item.price,
  }));
  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const tax = Math.round(subtotal * 0.1 * 100) / 100;
  return { ...data, total: subtotal + tax, tax, processedAt: new Date().toISOString() };
}
```

---

## UserIngestionPipeline

The [UserIngestionPipeline](https://github.com/hazel-js/hazeljs/blob/main/hazeljs-data-starter/src/pipelines/user-ingestion.pipeline.ts) shows user profile ingestion:

1. **normalize** – Lowercase email, trim name, clamp age 0–150  
2. **validate** – Email format, name length, role enum  
3. **sanitize** – Remove internal fields, add `ingestedAt`  

This pattern is reusable for customer data, CRM imports, and identity pipelines.

---

## REST API Walkthrough

### Process Single Order

```bash
curl -X POST http://localhost:3001/data/pipeline/orders \
  -H "Content-Type: application/json" \
  -d '{
    "id": "ord-001",
    "customerId": "cust-123",
    "items": [{ "sku": "WIDGET-A", "qty": 2, "price": 29.99 }],
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
    "items": [{ "sku": "WIDGET-A", "qty": 2, "price": 29.99, "subtotal": 59.98 }],
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
  -d '{"orders": [ { "id": "ord-1", "customerId": "c1", "items": [{ "sku": "A", "qty": 1, "price": 10 }], "status": "paid", "createdAt": "2025-01-01" } ]}'
```

The [StreamService.processBatch](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/pipelines/stream.service.ts) processes each item through the pipeline.

### Process User

```bash
curl -X POST http://localhost:3001/data/pipeline/users \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "name": "Alice Smith", "age": 28, "role": "user"}'
```

### Quality Checks

**GET** (sample data):

```bash
curl http://localhost:3001/data/quality
```

**POST** (custom data):

```bash
curl -X POST http://localhost:3001/data/quality \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "orders",
    "data": [{ "id": "1", "customerId": "c1", "items": [], "status": "paid", "createdAt": "2025-01-01" }]
  }'
```

The [QualityService](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/quality/quality.service.ts) runs [registered checks](https://github.com/hazel-js/hazeljs/blob/main/hazeljs-data-starter/src/data/data.bootstrap.ts) (completeness, notNull) and returns a [DataQualityReport](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/quality/quality.service.ts).

---

## Schema API Reference

[@hazeljs/data](https://www.npmjs.com/package/@hazeljs/data) provides a fluent [Schema](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/schema/schema.ts) builder:

```typescript
import { Schema } from '@hazeljs/data';

Schema.string()        // .min(n), .max(n), .email(), .uuid(), .oneOf([...])
Schema.number()        // .min(n), .max(n)
Schema.date()
Schema.object(shape)   // shape: Record<string, BaseSchema>
Schema.array(itemSchema)
```

Example:

```typescript
const UserSchema = Schema.object({
  email: Schema.string().email(),
  name: Schema.string().min(1).max(200),
  age: Schema.number().min(0).max(150),
  role: Schema.string().oneOf(['user', 'admin', 'moderator', 'guest']),
});
```

Validation throws [SchemaValidationException](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/validators/schema.validator.ts) with structured errors when data fails.

---

## Programmatic Pipeline Execution

Run pipelines without the HTTP server:

```bash
npm run run:sample
```

This loads [sample-orders.json](https://github.com/hazel-js/hazeljs/blob/main/hazeljs-data-starter/src/data/sample-orders.json) and [sample-users.json](https://github.com/hazel-js/hazeljs/blob/main/hazeljs-data-starter/src/data/sample-users.json) and processes them via the [run-sample-pipelines script](https://github.com/hazel-js/hazeljs/blob/main/hazeljs-data-starter/src/scripts/run-sample-pipelines.ts). Useful for:

- CI/CD data validation jobs  
- Batch imports  
- Local testing  

---

## Extending to Production

### 1. Flink Integration

Configure [DataModule.forRoot()](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/data.module.ts) with a Flink client:

```typescript
DataModule.forRoot({
  flink: {
    url: process.env.FLINK_REST_URL || 'http://localhost:8081',
    timeout: 30000,
  },
})
```

Use [FlinkService](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/flink.service.ts) and [@Stream](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/decorators/stream.decorator.ts) for Kafka/Flink-style streaming.

### 2. @Stream Pipelines

Add `@Stream({ name, source, sink, parallelism })` for real-time processing. The [Stream decorator](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/decorators/stream.decorator.ts) and [StreamProcessor](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/streaming/stream.processor.ts) support async iterables and batch processing.

### 3. PipelineBuilder

Compose pipelines programmatically with [PipelineBuilder](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/pipelines/pipeline.builder.ts) and [PipelineStepConfig](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/pipelines/pipeline.builder.ts).

### 4. Built-in Transformers

Use [TransformerService](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/transformers/transformer.service.ts) and [built-in transformers](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/transformers/built-in.transformers.ts): `trimString`, `toLowerCase`, `toUpperCase`, `parseJson`, `stringifyJson`, `pick`, `omit`, `renameKeys`.

### 5. Custom Quality Checks

Register custom checks with [QualityService.registerCheck()](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/quality/quality.service.ts). Use `completeness(requiredFields)` and `notNull(fields)` or pass custom functions.

### 6. Integrate with @hazeljs/ml

Combine [@hazeljs/data](https://www.npmjs.com/package/@hazeljs/data) with [@hazeljs/ml](https://www.npmjs.com/package/@hazeljs/ml) for ML training pipelines—use data pipelines to prepare training data before passing to [TrainerService](https://github.com/hazel-js/hazeljs/blob/main/packages/ml/src/training/trainer.service.ts).

---

## Summary

The [HazelJS Data Starter](https://github.com/hazel-js/hazeljs) demonstrates how to build production ETL pipelines in Node.js with:

- **Decorator-based pipelines** via [@hazeljs/data](https://www.npmjs.com/package/@hazeljs/data)  
- **OrderProcessingPipeline** and **UserIngestionPipeline** as real-world examples  
- **Schema validation** with a fluent Schema API  
- **Batch processing** via [StreamService](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/pipelines/stream.service.ts)  
- **Data quality checks** with [QualityService](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/quality/quality.service.ts)  
- **REST API** for pipeline execution and quality reports  

You can use it as a template for order processing, user ingestion, event streaming, or any ETL workload that fits the same pattern.

---

## Links and Resources

| Resource | URL |
|----------|-----|
| **HazelJS** | [https://hazeljs.com](https://hazeljs.com) |
| **HazelJS GitHub** | [https://github.com/hazel-js/hazeljs](https://github.com/hazel-js/hazeljs) |
| **@hazeljs/data on npm** | [https://www.npmjs.com/package/@hazeljs/data](https://www.npmjs.com/package/@hazeljs/data) |
| **@hazeljs/core on npm** | [https://www.npmjs.com/package/@hazeljs/core](https://www.npmjs.com/package/@hazeljs/core) |
| **@hazeljs/ml on npm** | [https://www.npmjs.com/package/@hazeljs/ml](https://www.npmjs.com/package/@hazeljs/ml) |
| **@hazeljs/ai on npm** | [https://www.npmjs.com/package/@hazeljs/ai](https://www.npmjs.com/package/@hazeljs/ai) |
| **Data package source** | [packages/data](https://github.com/hazel-js/hazeljs/tree/main/packages/data) |
| **ML package source** | [packages/ml](https://github.com/hazel-js/hazeljs/tree/main/packages/ml) |
| **ETLService** | [pipelines/etl.service.ts](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/pipelines/etl.service.ts) |
| **PipelineBase** | [pipelines/pipeline.base.ts](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/pipelines/pipeline.base.ts) |
| **Schema** | [schema/schema.ts](https://github.com/hazel-js/hazeljs/blob/main/packages/data/src/schema/schema.ts) |
| **Apache Flink** | [https://flink.apache.org](https://flink.apache.org) |
| **Open Collective** | [https://opencollective.com/hazeljs](https://opencollective.com/hazeljs) |

---

*This blog post was created for the HazelJS Data Starter. For questions and contributions, visit the [HazelJS GitHub repository](https://github.com/hazel-js/hazeljs) or [community](https://hazeljs.com).*
