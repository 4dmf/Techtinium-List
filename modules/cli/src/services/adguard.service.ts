import { Injectable } from '@nestjs/common';
import { isIPv4, isIPv6 } from 'net';

const DOMAIN_REGEX =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

const COSMETIC_MARKERS = [
  '##',
  '#@#',
  '#?#',
  '#$#',
  '#%#',
  '#@$#',
  '#@%#',
  '#@?#',
  '#+js',
];

const IGNORE_DOMAINS = new Set([
  'localhost',
  'localhost.localdomain',
  'local',
  'broadcasthost',
  'ip6-localhost',
  'ip6-loopback',
  'ip6-localnet',
  'ip6-mcastprefix',
  'ip6-allnodes',
  'ip6-allrouters',
  'ip6-allhosts',
]);

export type RuleKind = 'domain' | 'ip' | 'cidr';

export interface NormalizedRule {
  kind: RuleKind;
  value: string;
}

@Injectable()
/**
 * @see https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters
 */
export class AdguardRuleService {
  public FromUrlOrIp(value: string, allowRule: boolean): NormalizedRule | null {
    return this.normalizeToRawHost(value, allowRule);
  }

  public FromAdGuard(value: string, allowRule: boolean): NormalizedRule | null {
    return this.normalizeToRawHost(value, allowRule);
  }

  private normalizeToRawHost(
    value: string,
    allowRule: boolean,
  ): NormalizedRule | null {
    let text = (value ?? '').trim();

    if (text === '') {
      return null;
    }

    if (
      text.startsWith('#') ||
      text.startsWith('!') ||
      text.startsWith('[') ||
      text.startsWith('%') ||
      text.startsWith('/')
    ) {
      return null;
    }

    if (COSMETIC_MARKERS.some((marker) => text.includes(marker))) {
      return null;
    }

    const hashIndex = text.indexOf('#');
    if (hashIndex !== -1) {
      text = text.slice(0, hashIndex).trim();
    }

    if (text === '') {
      return null;
    }

    if (text.startsWith('@@')) {
      if (!allowRule) {
        return null;
      }
      text = text.slice(2).trim();
    }

    text = text.replace(/^\|\|?/, '').trim();
    text = text.replace(/^\*\.?/, '').trim();

    const dollarIndex = text.indexOf('$');
    if (dollarIndex !== -1) {
      text = text.slice(0, dollarIndex).trim();
    }

    const caretIndex = text.indexOf('^');
    if (caretIndex !== -1) {
      text = text.slice(0, caretIndex).trim();
    }

    const hostsMatch = text.match(/^[0-9a-fA-F:.]+\s+(\S+)/);
    if (hostsMatch) {
      text = hostsMatch[1].trim();
    }

    if (text === '') {
      return null;
    }

    if (text.startsWith('http://') || text.startsWith('https://')) {
      try {
        text = new URL(text).hostname;
      } catch {
        return null;
      }
    }

    text = text.split(/\s+/)[0].trim();

    const cidr = this.parseCidr(text);
    if (cidr) {
      return cidr;
    }

    const slashIndex = text.indexOf('/');
    if (slashIndex > 0) {
      const address = text.slice(0, slashIndex);
      if (isIPv4(address) || isIPv6(address)) {
        return null;
      }
    }

    text = text.split('/')[0].trim();

    if (text.includes(':') && !text.includes(']')) {
      const colonCount = (text.match(/:/g) ?? []).length;
      if (colonCount === 1) {
        text = text.split(':')[0].trim();
      }
    }

    text = text
      .replace(/^\[|\]$/g, '')
      .replace(/^\.+|\.+$/g, '')
      .trim();

    if (text === '') {
      return null;
    }

    if (isIPv4(text)) {
      return { kind: 'ip', value: text };
    }

    if (isIPv6(text)) {
      return { kind: 'ip', value: text };
    }

    let domain = text.toLowerCase();
    if (!/^[\u0021-\u007E]+$/.test(domain)) {
      try {
        domain = new URL(`http://${domain}`).hostname.toLowerCase();
      } catch {
        return null;
      }
    }

    if (IGNORE_DOMAINS.has(domain)) {
      return null;
    }

    if (DOMAIN_REGEX.test(domain)) {
      return { kind: 'domain', value: domain };
    }

    return null;
  }

  private parseCidr(value: string): NormalizedRule | null {
    const slashIndex = value.indexOf('/');
    if (slashIndex <= 0) {
      return null;
    }

    const address = value.slice(0, slashIndex);
    const prefixText = value.slice(slashIndex + 1);

    if (!/^\d{1,3}$/.test(prefixText)) {
      return null;
    }

    const prefix = Number(prefixText);

    if (isIPv4(address)) {
      if (prefix > 32) {
        return null;
      }
      return { kind: 'cidr', value: `${address}/${prefix}` };
    }

    if (isIPv6(address)) {
      if (prefix > 128) {
        return null;
      }
      return { kind: 'cidr', value: `${address}/${prefix}` };
    }

    return null;
  }
}
