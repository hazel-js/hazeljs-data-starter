/**
 * HazelJS Data Starter - Bootstrap
 *
 * Real-world example showcasing @hazeljs/data:
 * - ETL pipelines with @Pipeline, @Transform, @Validate
 * - Schema validation
 * - Stream/batch processing
 * - Data quality checks
 *
 * Run: npm run dev
 * API: http://localhost:3001
 */
import 'reflect-metadata';
import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';
import logger from '@hazeljs/core';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function bootstrap(): Promise<void> {
  logger.info('Starting HazelJS Data Starter...');

  const app = new HazelApp(AppModule);

  await app.listen(PORT);

  logger.info('');
  logger.info('HazelJS Data Starter running at http://localhost:' + PORT);
  logger.info('');
  logger.info('API Endpoints:');
  logger.info('  POST /data/pipeline/orders     - Process single order');
  logger.info('  POST /data/pipeline/orders/batch - Batch process orders');
  logger.info('  POST /data/pipeline/users     - Process single user');
  logger.info('  POST /data/pipeline/logs     - Process log (PipelineBuilder)');
  logger.info('  POST /data/quality             - Run data quality checks');
  logger.info('  POST /data/quality/profile     - Run data profiling');
  logger.info('  POST /data/quality/anomalies   - Detect anomalies');
  logger.info('  GET  /health                  - Health check');
  logger.info('');
}

bootstrap().catch((err) => {
  logger.error('Failed to start:', err);
  process.exit(1);
});
