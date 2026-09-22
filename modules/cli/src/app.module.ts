import { Module } from '@nestjs/common';
import { GenerateCommand } from './commands/generate.command';
import {
  LogService,
  FileService,
  AdguardRuleService,
  DedupService,
} from './services';

@Module({
  imports: [],
  controllers: [],
  providers: [
    LogService,
    FileService,
    AdguardRuleService,
    DedupService,
    GenerateCommand,
  ],
})
export class AppModule {}
