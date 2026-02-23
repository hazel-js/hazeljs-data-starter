#!/usr/bin/env ts-node
/**
 * Run sample data through pipelines (no HTTP server)
 *
 * Usage: npm run run:sample
 */
import 'reflect-metadata';
import { ETLService, SchemaValidator } from '@hazeljs/data';
import { OrderProcessingPipeline, UserIngestionPipeline } from '../pipelines';
import * as fs from 'fs';
import * as path from 'path';

// Note: In a real setup you'd bootstrap the app or use the container properly.
// This script demonstrates programmatic pipeline execution.
async function main(): Promise<void> {
  // Minimal setup - we need ETLService and SchemaValidator for pipelines
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

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
