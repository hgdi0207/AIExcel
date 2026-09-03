import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { FilesModule } from '../files/files.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [AiModule, FilesModule, UsageModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
