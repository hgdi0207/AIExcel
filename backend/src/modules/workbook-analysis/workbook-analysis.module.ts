import { Module } from '@nestjs/common';
import { WorkbookAnalysisService } from './workbook-analysis.service';

@Module({
  providers: [WorkbookAnalysisService],
  exports: [WorkbookAnalysisService],
})
export class WorkbookAnalysisModule {}
