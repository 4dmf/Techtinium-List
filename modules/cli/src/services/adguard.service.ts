import { Injectable } from '@nestjs/common';
const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

const IGNORE_HOST_START = ['0.0.0.0', '127.0.0.1', '::1'];

@Injectable()
/**
 * @see https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters
 */
export class AdguardRuleService {
  public FromUrlOrIp(value: string, _allowRule: boolean): string | null {
    return this.normalizeToRawHost(value);
  }

  public FromAdGuard(value: string): string | null {
    return this.normalizeToRawHost(value);
  }

  private normalizeToRawHost(value: string): string | null {
    value = value.split('#')[0].split('!')[0].trim();

    for (const hostStart of IGNORE_HOST_START) {
      if (value.startsWith(hostStart)) {
        value = value.slice(hostStart.length).trim();
      }
    }

    if (value === '') {
      return null;
    }

    value = value.replace(/^@@/, '').trim();
    value = value.replace(/^\|\|/, '').trim();
    value = value.replace(/^\|/, '').trim();

    if (value.includes('$')) {
      value = value.split('$')[0].trim();
    }

    if (value.includes('^')) {
      value = value.split('^')[0].trim();
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      try {
        value = new URL(value).hostname;
      } catch {
        return null;
      }
    }

    value = value.split('/')[0].trim();

    if (value.includes(':') && !value.includes(']')) {
      const colonCount = (value.match(/:/g) ?? []).length;
      if (colonCount === 1) {
        value = value.split(':')[0].trim();
      }
    }

    value = value.replace(/^\[|\]$/g, '').replace(/^\.+|\.+$/g, '').trim();

    if (value === '') {
      return null;
    }

    if (IPV4_REGEX.test(value) || IPV6_REGEX.test(value)) {
      return value;
    }

    const normalizedDomain = value.toLowerCase();
    if (DOMAIN_REGEX.test(normalizedDomain)) {
      return normalizedDomain;
    }

    return null;
  }
}
