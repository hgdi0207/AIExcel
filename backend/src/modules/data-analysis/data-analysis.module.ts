import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { FilesModule } from '../files/files.module';
import { JobsModule } from '../jobs/jobs.module';
import { UsageModule } from '../usage/usage.module';
import { WorkbookAnalysisModule } from '../workbook-analysis/workbook-analysis.module';
import { DataAnalysisController } from './data-analysis.controller';

@Module({
  imports: [AiModule, FilesModule, JobsModule, UsageModule, WorkbookAnalysisModule],
  controllers: [DataAnalysisController],
})
export class DataAnalysisModule {}
