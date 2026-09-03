import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FilesModule } from './modules/files/files.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { ChartsModule } from './modules/charts/charts.module';
import { DataAnalysisModule } from './modules/data-analysis/data-analysis.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { PivotBuilderModule } from './modules/pivot-builder/pivot-builder.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsageModule } from './modules/usage/usage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AiModule,
    HealthModule,
    AuthModule,
    DashboardModule,
    FilesModule,
    AssistantModule,
    JobsModule,
    DataAnalysisModule,
    PivotBuilderModule,
    ChartsModule,
    ReportsModule,
    BillingModule,
    UsageModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
