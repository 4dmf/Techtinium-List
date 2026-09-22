/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable } from '@nestjs/common';
import * as FS from 'fs';
import * as Path from 'path';
import Axios from 'axios';
import axiosRetry from 'axios-retry';
import { LogService } from './log.service';

// https://www.npmjs.com/package/axios-retry
axiosRetry(Axios, {
  retries: 3,
  retryDelay: (retryCount, error) =>
    axiosRetry.exponentialDelay(retryCount, error),
});

const URL_REGEX =
  /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;

@Injectable()
export class FileService {
  constructor(private logService: LogService) {}

  public PathExist(path: string): boolean {
    return FS.existsSync(path);
  }

  public ListFiles(dirPath: string): string[] {
    const files = FS.readdirSync(dirPath);
    let arrayOfFiles: string[] = [];

    for (const file of files) {
      if (FS.statSync(dirPath + '/' + file).isDirectory()) {
        arrayOfFiles = arrayOfFiles.concat(
          this.ListFiles(dirPath + '/' + file),
        );
      } else {
        arrayOfFiles.push(Path.join(dirPath, '/', file));
      }
    }

    return arrayOfFiles;
  }

  public GetFileLines(filePath: string): string[] {
    const data = FS.readFileSync(filePath, {
      encoding: 'utf8',
    });
    return data.split(/\r?\n/);
  }

  public async GetRemoteFileLines(filePath: string): Promise<string[]> {
    if (!filePath.match(URL_REGEX)) {
      return [];
    }

    try {
      const response = await Axios.get(filePath, {
        responseType: 'text',
        responseEncoding: 'UTF-8',
        decompress: true,
        validateStatus: () => true,
      });
      if (response.status !== 200) {
        this.logService.warn(
          `List "${filePath}" not found.`,
          response.data,
          response.status,
          response.statusText,
        );
        return [];
      }
      return response.data.split(/\r?\n/);
    } catch (exception) {
      this.logService.error(filePath, exception);
    }

    return [];
  }

  public ReplaceFile(filePath: string, data: string): void {
    FS.writeFileSync(filePath, data, {
      encoding: 'utf-8',
      flag: 'w',
    });
  }

  public ReplaceFileLines(filePath: string, lines: Iterable<string>): void {
    const chunkSize = 8 * 1024 * 1024;
    let chunks: string[] = [];
    let size = 0;
    let started = false;

    const flush = (): void => {
      if (chunks.length === 0) {
        return;
      }
      const data = chunks.join('');
      if (started) {
        FS.appendFileSync(filePath, data, { encoding: 'utf-8' });
      } else {
        FS.writeFileSync(filePath, data, { encoding: 'utf-8', flag: 'w' });
        started = true;
      }
      chunks = [];
      size = 0;
    };

    let first = true;
    for (const line of lines) {
      chunks.push(first ? line : `\n${line}`);
      size += line.length + 1;
      first = false;
      if (size >= chunkSize) {
        flush();
      }
    }

    if (chunks.length > 0) {
      flush();
    } else if (!started) {
      FS.writeFileSync(filePath, '', { encoding: 'utf-8', flag: 'w' });
    }
  }
}
