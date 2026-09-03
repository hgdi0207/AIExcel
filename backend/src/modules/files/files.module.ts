import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { UsageModule } from '../usage/usage.module';
import { WorkbookAnalysisModule } from '../workbook-analysis/workbook-analysis.module';

@Module({
  imports: [UsageModule, WorkbookAnalysisModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
