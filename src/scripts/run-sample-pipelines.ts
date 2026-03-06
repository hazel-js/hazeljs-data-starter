#!/usr/bin/env ts-node
/**
 * Run sample data through pipelines (no HTTP server)
 *
 * Demonstrates:
 * - OrderProcessingPipeline, UserIngestionPipeline (decorator-based)
 * - logEnrichmentPipeline (PipelineBuilder programmatic)
 * - SchemaFaker for generating test data
 * - StreamProcessor with tumbling window
 *
 * Usage: npm run run:sample
 */
import {
  Schema,
  SchemaFaker,
  StreamProcessor,
  ETLService,
  SchemaValidator,
} from '@hazeljs/data';
import { OrderProcessingPipeline, UserIngestionPipeline, logEnrichmentPipeline } from '../pipelines';
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  const schemaValidator = new SchemaValidator();
  const etlService = new ETLService(schemaValidator);
  const orderPipeline = new OrderProcessingPipeline(etlService);
  const userPipeline = new UserIngestionPipeline(etlService);

  console.log('Running sample pipelines...\n');

  // Orders
  const ordersPath = path.join(__dirname, '../data/sample-orders.json');
  if (fs.existsSync(ordersPath)) {
    const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf-8'));
    console.log('OrderProcessingPipeline:');
    for (let i = 0; i < orders.length; i++) {
      const result = await orderPipeline.execute(orders[i]);
      console.log(`  Order ${i + 1}:`, JSON.stringify(result));
    }
  }

  console.log('');

  // Users
  const usersPath = path.join(__dirname, '../data/sample-users.json');
  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    console.log('UserIngestionPipeline:');
    for (let i = 0; i < users.length; i++) {
      const result = await userPipeline.execute(users[i]);
      console.log(`  User ${i + 1}:`, JSON.stringify(result));
    }
  }

  // PipelineBuilder (log enrichment)
  console.log('\nLogEnrichmentPipeline (PipelineBuilder):');
  const logResult = await logEnrichmentPipeline.execute({
    level: 'error',
    message: 'Connection timeout',
    host: 'api-01',
  });
  console.log('  Result:', JSON.stringify(logResult));

  // SchemaFaker - generate fake data from schema
  console.log('\nSchemaFaker (fake data from schema):');
  const SimpleUserSchema = Schema.object({
    name: Schema.string(),
    age: Schema.number().min(0).max(150),
  });
  const fakeUsers = SchemaFaker.generateMany(SimpleUserSchema, 2);
  console.log('  Generated:', JSON.stringify(fakeUsers));

  // StreamProcessor - tumbling window
  console.log('\nStreamProcessor (tumbling window):');
  async function* timestampedSource() {
    yield { value: 1, timestamp: 100 };
    yield { value: 2, timestamp: 150 };
    yield { value: 3, timestamp: 250 };
  }
  const processor = new StreamProcessor(etlService);
  const batches: unknown[] = [];
  for await (const batch of processor.tumblingWindow(timestampedSource(), 100)) {
    batches.push(batch);
  }
  console.log('  Batches:', JSON.stringify(batches));

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
