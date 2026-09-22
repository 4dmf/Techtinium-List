import { Command, CommandRunner, Option } from 'nest-commander';
import { AdGuardList, Badge } from '../domain';
import {
  LogService,
  FileService,
  AdguardRuleService,
  DedupService,
} from '../services';
import * as Path from 'path';

interface GenerateCommandOptions {
  name: string;
  external: string;
  concatExternal: string;
  custom: string;
  output: string;
  badge?: string;
  convertToAllow?: boolean;
  allowList?: string | null;
  debug?: boolean;
}

@Command({ name: 'generate', description: 'Generate Technitium List' })
export class GenerateCommand extends CommandRunner {
  private _list = new AdGuardList();

  constructor(
    private readonly logService: LogService,
    private readonly fileService: FileService,
    private readonly adguardRuleService: AdguardRuleService,
    private readonly dedupService: DedupService,
  ) {
    super();
  }

  async run(
    _passedParam: string[],
    options: GenerateCommandOptions,
  ): Promise<void> {
    const allowRule = options.convertToAllow ?? false;

    /**
     * Get Rules
     */
    const customFilesPath = this.fileService.ListFiles(options.custom);
    const externalFilesPath = this.fileService.ListFiles(options.external);
    const concatExternalFilesPath = this.fileService.ListFiles(
      options.concatExternal,
    );

    /**
     * Custom
     */
    for (const customFilePath of customFilesPath) {
      this.logService.log(`Loading ${customFilePath}...`);
      const lines = this.fileService.GetFileLines(customFilePath);
      for (const line of lines) {
        const rule = this.adguardRuleService.FromAdGuard(line, allowRule);
        if (rule && rule.kind === 'domain') {
          this._list.add(rule.value, [customFilePath]);
        }
      }
    }

    /**
     * Concat
     */
    for (const concatExternalFilePath of concatExternalFilesPath) {
      this.logService.log(`Loading ${concatExternalFilePath}...`);
      const concatExternalFiles = this.fileService.GetFileLines(
        concatExternalFilePath,
      );
      for (const concatExternalFile of concatExternalFiles) {
        const lines =
          await this.fileService.GetRemoteFileLines(concatExternalFile);
        for (const line of lines) {
          const rule = this.adguardRuleService.FromAdGuard(line, allowRule);
          if (rule && rule.kind === 'domain') {
            this._list.add(rule.value, [
              concatExternalFilePath,
              concatExternalFile,
            ]);
          }
        }
      }
    }

    /**
     * External
     */
    for (const externalFilePath of externalFilesPath) {
      this.logService.log(`Loading ${externalFilePath}...`);
      const externalFiles = this.fileService.GetFileLines(externalFilePath);
      for (const externalFile of externalFiles) {
        const lines = await this.fileService.GetRemoteFileLines(externalFile);
        for (const line of lines) {
          const rule = this.adguardRuleService.FromUrlOrIp(line, allowRule);
          if (rule && rule.kind === 'domain') {
            this._list.add(rule.value, [externalFilePath, externalFile]);
          }
        }
      }
    }

    /**
     * Generate List
     */
    let entries = this.dedupService.process(this._list.export());

    if (!allowRule && options.allowList) {
      const allowed = new Set(
        this.fileService
          .GetFileLines(options.allowList)
          .map((line) => line.trim().toLowerCase())
          .filter((line) => line !== ''),
      );
      entries = this.dedupService.removeCoveredBy(entries, allowed);
    }

    this.fileService.ReplaceFileLines(
      Path.join(options.output, options.name),
      this.getFileLines(entries, false),
    );

    if (options.debug ?? true) {
      this.fileService.ReplaceFileLines(
        Path.join(options.output, 'debug.' + options.name),
        this.getFileLines(entries, true),
      );
    }

    /**
     * Generate Badge
     */
    if (options.badge) {
      const badge: Badge = {
        schemaVersion: 1,
        label: options.convertToAllow ? 'Allow' : 'Block',
        message: entries.size.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','),
        color: options.convertToAllow ? 'green' : 'red',
      };
      this.fileService.ReplaceFile(
        Path.join(options.output, options.badge),
        JSON.stringify(badge),
      );
    }
  }

  private *getFileLines(
    entries: Map<string, string>,
    debug: boolean,
  ): Generator<string> {
    for (const [rule, origin] of entries) {
      yield debug ? `${rule} #${origin}` : rule;
    }
  }

  @Option({
    flags: '-n, --name [string]',
    description: 'List File Name',
    required: true,
  })
  parseName(val: string): string {
    return val;
  }

  @Option({
    flags: '-b, --badge [string]',
    description: 'Badge File Name',
    required: false,
  })
  parseBadge(val?: string): string | null {
    if (val && val.length > 0) {
      return val;
    }
    return null;
  }

  @Option({
    flags: '--convertToAllow [boolean]',
    description: 'Convert rule to allow rule',
    required: false,
    defaultValue: false,
  })
  parseConvertToAllow(val: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(val);
  }

  @Option({
    flags: '--allowList [string]',
    description: 'Allow list whitelist; covered block entries are removed',
    required: false,
  })
  parseAllowList(val?: string): string | null {
    if (val && val.length > 0) {
      return this._validatePath(val);
    }
    return null;
  }

  @Option({
    flags: '--debug [boolean]',
    description: 'Write the debug list',
    required: false,
    defaultValue: true,
  })
  parseDebug(val: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(val);
  }

  @Option({
    flags: '-e, --external [string]',
    description: 'External Path',
    required: true,
  })
  parseExternalAllowPath(val: string): string {
    return this._validatePath(val);
  }

  @Option({
    flags: '-ce, --concatExternal [string]',
    description: 'AdGuard Rules to add from external lists',
    required: true,
  })
  parseConcatExternal(val: string): string {
    return this._validatePath(val);
  }

  @Option({
    flags: '-c, --custom [string]',
    description: 'Custom Path',
    required: true,
  })
  parseCustomAllowPath(val: string): string {
    return this._validatePath(val);
  }

  @Option({
    flags: '-o, --output [string]',
    description: 'Output Path',
    required: true,
  })
  parseOutput(val: string): string {
    return this._validatePath(val);
  }

  private _validatePath(val: string): string {
    if (!this.fileService.PathExist(val)) {
      this.logService.error(`Path "${val}" must be valid.`);
      process.exit(1);
    }
    return val;
  }
}
