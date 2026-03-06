/**
 * Data Controller - REST API for ETL pipelines and data quality
 *
 * Endpoints:
 * - POST /data/pipeline/orders - Process order through OrderProcessingPipeline
 * - POST /data/pipeline/users - Process user through UserIngestionPipeline
 * - POST /data/pipeline/orders/batch - Batch process orders
 * - POST /data/quality - Run quality checks on data
 */
import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestError,
  InternalServerError,
  logger,
} from '@hazeljs/core';
import { StreamService, QualityService } from '@hazeljs/data';
import { OrderProcessingPipeline, UserIngestionPipeline, logEnrichmentPipeline } from '../pipelines';

@Controller('/data')
export class DataController {
  /**
   * GET /data - List available endpoints
   */
  @Get()
  async index(): Promise<{ endpoints: string[] }> {
    return {
      endpoints: [
        'GET  /data - This info',
        'GET  /data/pipeline/orders - Order pipeline info',
        'POST /data/pipeline/orders - Process single order',
        'POST /data/pipeline/orders/batch - Batch process orders',
        'POST /data/pipeline/users - Process single user',
        'POST /data/pipeline/logs - Process log (PipelineBuilder)',
        'GET  /data/quality - Run quality checks (sample data)',
        'POST /data/quality - Run quality checks (custom data)',
        'POST /data/quality/profile - Data profiling',
        'POST /data/quality/anomalies - Anomaly detection',
      ],
    };
  }

  constructor(
    private readonly orderPipeline: OrderProcessingPipeline,
    private readonly userPipeline: UserIngestionPipeline,
    private readonly streamService: StreamService,
    private readonly qualityService: QualityService
  ) {}

  /**
   * GET /data/pipeline/orders - API info (use POST to process orders)
   */
  @Get('/pipeline/orders')
  async pipelineOrdersInfo(): Promise<{ message: string; usage: string }> {
    return {
      message: 'Order pipeline - use POST with JSON body to process an order',
      usage: 'curl -X POST http://localhost:3001/data/pipeline/orders -H "Content-Type: application/json" -d \'{"id":"ord-001","customerId":"cust-123","items":[{"sku":"A","qty":1,"price":10}],"status":"paid","createdAt":"2025-01-01"}\'',
    };
  }

  /**
   * POST /data/pipeline/orders - Process a single order
   */
  @Post('/pipeline/orders')
  async processOrder(
    @Body() body: Record<string, unknown>
  ): Promise<{ result: unknown }> {
    if (!body || typeof body !== 'object') {
      throw new BadRequestError('Request body must be an object');
    }

    try {
      const result = await this.orderPipeline.execute(body);
      return { result };
    } catch (error) {
      logger.error('Order processing failed:', error);
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Order processing failed'
      );
    }
  }

  /**
   * POST /data/pipeline/orders/batch - Batch process orders
   */
  @Post('/pipeline/orders/batch')
  async processOrdersBatch(
    @Body() body: { orders?: Record<string, unknown>[] }
  ): Promise<{ results: unknown[]; count: number }> {
    const orders = body?.orders ?? [];
    if (!Array.isArray(orders) || orders.length === 0) {
      throw new BadRequestError('orders array is required');
    }

    try {
      const results = await this.streamService.processBatch(
        this.orderPipeline,
        orders
      );
      return { results, count: results.length };
    } catch (error) {
      logger.error('Batch order processing failed:', error);
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Batch processing failed'
      );
    }
  }

  /**
   * GET /data/pipeline/users - API info (use POST to process user)
   */
  @Get('/pipeline/users')
  async pipelineUsersInfo(): Promise<{ message: string; usage: string }> {
    return {
      message: 'User pipeline - use POST with JSON body',
      usage: 'curl -X POST http://localhost:3001/data/pipeline/users -H "Content-Type: application/json" -d \'{"email":"alice@example.com","name":"Alice","age":28,"role":"user"}\'',
    };
  }

  /**
   * POST /data/pipeline/users - Process a single user
   */
  @Post('/pipeline/users')
  async processUser(
    @Body() body: Record<string, unknown>
  ): Promise<{ result: unknown }> {
    if (!body || typeof body !== 'object') {
      throw new BadRequestError('Request body must be an object');
    }

    try {
      const result = await this.userPipeline.execute(body);
      return { result };
    } catch (error) {
      logger.error('User processing failed:', error);
      throw new InternalServerError(
        error instanceof Error ? error.message : 'User processing failed'
      );
    }
  }

  /**
   * GET /data/quality - Run quality checks with sample data (quick test)
   * POST /data/quality - Run quality checks with custom data
   */
  @Get('/quality')
  async runQualityChecksGet(): Promise<{ report: unknown }> {
    const sampleOrder = {
      id: 'ord-sample',
      customerId: 'cust-sample',
      items: [{ sku: 'SKU-1', qty: 1, price: 10 }],
      status: 'paid',
      createdAt: '2025-01-01',
    };
    const report = await this.qualityService.runChecks('sample', [sampleOrder]);
    return { report };
  }

  /**
   * POST /data/quality - Run quality checks on provided data
   */
  @Post('/quality')
  async runQualityChecks(
    @Body() body: { dataset?: string; data?: unknown }
  ): Promise<{ report: unknown }> {
    const dataset = body?.dataset ?? 'default';
    const data = body?.data ?? body;

    try {
      const report = await this.qualityService.runChecks(dataset, data);
      return { report };
    } catch (error) {
      logger.error('Quality check failed:', error);
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Quality check failed'
      );
    }
  }

  /**
   * GET /data/quality/profile - API info (use POST for profiling)
   */
  @Get('/quality/profile')
  async profileInfo(): Promise<{ message: string; usage: string }> {
    return {
      message: 'Data profiling - use POST with JSON body',
      usage: 'curl -X POST http://localhost:3001/data/quality/profile -H "Content-Type: application/json" -d \'{"dataset":"users","data":[{"name":"Alice","age":28},{"name":"Bob","age":35}]}\'',
    };
  }

  /**
   * POST /data/quality/profile - Run data profiling
   */
  @Post('/quality/profile')
  async runQualityProfile(
    @Body() body: { dataset?: string; data?: Record<string, unknown>[] }
  ): Promise<{ profile: unknown }> {
    const dataset = body?.dataset ?? 'default';
    const data = body?.data ?? [];

    try {
      const profile = this.qualityService.profile(dataset, data);
      return { profile };
    } catch (error) {
      logger.error('Quality profile failed:', error);
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Quality profile failed'
      );
    }
  }

  /**
   * GET /data/quality/anomalies - API info (use POST to detect anomalies)
   */
  @Get('/quality/anomalies')
  async anomaliesInfo(): Promise<{ message: string; usage: string }> {
    return {
      message: 'Anomaly detection - use POST with JSON body',
      usage: 'curl -X POST http://localhost:3001/data/quality/anomalies -H "Content-Type: application/json" -d \'{"data":[{"value":10},{"value":11},{"value":1000}],"fields":["value"],"threshold":1.5}\'',
    };
  }

  /**
   * POST /data/quality/anomalies - Detect anomalies in data
   */
  @Post('/quality/anomalies')
  async detectAnomalies(
    @Body() body: { data?: Record<string, unknown>[]; fields?: string[]; threshold?: number }
  ): Promise<{ anomalies: unknown[] }> {
    const data = body?.data ?? [];
    const fields = body?.fields ?? [];
    const threshold = body?.threshold ?? 2;

    try {
      const anomalies = this.qualityService.detectAnomalies(data, fields, threshold);
      return { anomalies };
    } catch (error) {
      logger.error('Anomaly detection failed:', error);
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Anomaly detection failed'
      );
    }
  }

  /**
   * GET /data/pipeline/logs - API info (use POST to process log)
   */
  @Get('/pipeline/logs')
  async pipelineLogsInfo(): Promise<{ message: string; usage: string }> {
    return {
      message: 'Log pipeline (PipelineBuilder) - use POST with JSON body',
      usage: 'curl -X POST http://localhost:3001/data/pipeline/logs -H "Content-Type: application/json" -d \'{"level":"error","message":"Connection timeout","host":"api-01"}\'',
    };
  }

  /**
   * POST /data/pipeline/logs - Process log via PipelineBuilder (programmatic pipeline)
   */
  @Post('/pipeline/logs')
  async processLog(
    @Body() body: Record<string, unknown>
  ): Promise<{ result: unknown }> {
    if (!body || typeof body !== 'object') {
      throw new BadRequestError('Request body must be an object');
    }

    try {
      const result = await logEnrichmentPipeline.execute(body);
      return { result };
    } catch (error) {
      logger.error('Log processing failed:', error);
      throw new InternalServerError(
        error instanceof Error ? error.message : 'Log processing failed'
      );
    }
  }
}
