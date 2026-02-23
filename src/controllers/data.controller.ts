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
import { OrderProcessingPipeline, UserIngestionPipeline } from '../pipelines';

@Controller('/data')
export class DataController {
  constructor(
    private readonly orderPipeline: OrderProcessingPipeline,
    private readonly userPipeline: UserIngestionPipeline,
    private readonly streamService: StreamService,
    private readonly qualityService: QualityService
  ) {}

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
   * GET /data/quality - Run quality checks with sample data (for quick testing)
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
}
