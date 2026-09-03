import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { FilesModule } from '../files/files.module';
import { JobsModule } from '../jobs/jobs.module';
import { UsageModule } from '../usage/usage.module';
import { PivotBuilderController } from './pivot-builder.controller';
import { PivotExportService } from './pivot-export.service';
import { PivotNativeExportClient } from './pivot-native-export.client';

@Module({
  imports: [AiModule, FilesModule, JobsModule, UsageModule],
  controllers: [PivotBuilderController],
  providers: [PivotExportService, PivotNativeExportClient],
})
export class PivotBuilderModule {}
