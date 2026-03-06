/**
 * Data Bootstrap - Register quality checks on startup
 */
import { Injectable } from '@hazeljs/core';
import { QualityService } from '@hazeljs/data';
import logger from '@hazeljs/core';

@Injectable()
export class DataBootstrap {
  constructor(private readonly qualityService: QualityService) {
    this.registerQualityChecks();
    logger.info('Data bootstrap: quality checks registered');
  }

  private registerQualityChecks(): void {
    this.qualityService.registerCheck(
      'order-completeness',
      this.qualityService.completeness(['id', 'customerId', 'items', 'status', 'createdAt'])
    );

    this.qualityService.registerCheck(
      'order-not-null',
      this.qualityService.notNull(['id', 'customerId'])
    );

    this.qualityService.registerCheck(
      'order-uniqueness',
      this.qualityService.uniqueness(['id'])
    );

    this.qualityService.registerCheck(
      'order-status-ref',
      this.qualityService.referentialIntegrity('status', [
        'pending',
        'paid',
        'shipped',
        'delivered',
        'cancelled',
      ])
    );

    this.qualityService.registerCheck(
      'user-completeness',
      this.qualityService.completeness(['email', 'name', 'age', 'role'])
    );

    this.qualityService.registerCheck(
      'user-age-range',
      this.qualityService.range('age', { min: 0, max: 150 })
    );

    this.qualityService.registerCheck(
      'user-role-ref',
      this.qualityService.referentialIntegrity('role', ['user', 'admin', 'moderator', 'guest'])
    );
  }
}
