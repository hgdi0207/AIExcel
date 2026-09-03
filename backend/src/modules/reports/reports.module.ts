import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { FilesModule } from '../files/files.module';
import { JobsModule } from '../jobs/jobs.module';
import { UsageModule } from '../usage/usage.module';
import { ReportsController } from './reports.controller';

@Module({
  imports: [AiModule, FilesModule, JobsModule, UsageModule],
  controllers: [ReportsController],
})
export class ReportsModule {}
