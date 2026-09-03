import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { FilesModule } from '../files/files.module';
import { JobsModule } from '../jobs/jobs.module';
import { UsageModule } from '../usage/usage.module';
import { WorkbookAnalysisModule } from '../workbook-analysis/workbook-analysis.module';
import { ChartsController } from './charts.controller';

@Module({
  imports: [AiModule, FilesModule, JobsModule, UsageModule, WorkbookAnalysisModule],
  controllers: [ChartsController],
})
export class ChartsModule {}
