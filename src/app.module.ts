/**
 * App Module - Data Starter Application
 *
 * Configures DataModule with ETL pipelines and controller.
 * DataBootstrap registers quality checks on init.
 */
import { HazelModule } from '@hazeljs/core';
import { DataModule } from '@hazeljs/data';
import { OrderProcessingPipeline, UserIngestionPipeline } from './pipelines';
import { DataController } from './controllers/data.controller';
import { DataBootstrap } from './data/data.bootstrap';

@HazelModule({
  imports: [DataModule.forRoot()],
  controllers: [DataController],
  providers: [OrderProcessingPipeline, UserIngestionPipeline, DataBootstrap],
})
export class AppModule {}
