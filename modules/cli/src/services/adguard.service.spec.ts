import { describe, expect, it } from '@jest/globals';
import { AdguardRuleService } from './adguard.service';

describe('AdguardRuleService', () => {
  const service = new AdguardRuleService();

  describe('domains', () => {
    it('strips wildcard prefixes', () => {
      expect(service.FromUrlOrIp('*.example.com', false)).toEqual({
        kind: 'domain',
        value: 'example.com',
      });
    });

    it('strips hosts prefixes', () => {
      expect(service.FromUrlOrIp('0.0.0.0 example.com', false)).toEqual({
        kind: 'domain',
        value: 'example.com',
      });
      expect(service.FromUrlOrIp('127.0.0.1 example.com', false)).toEqual({
        kind: 'domain',
        value: 'example.com',
      });
    });

    it('strips inline comments', () => {
      expect(service.FromUrlOrIp('example.com # comment', false)).toEqual({
        kind: 'domain',
        value: 'example.com',
      });
      expect(service.FromUrlOrIp('0.0.0.0 example.com#comment', false)).toEqual(
        { kind: 'domain', value: 'example.com' },
      );
    });

    it('normalizes AdGuard network rules', () => {
      expect(service.FromAdGuard('||example.com^$third-party', false)).toEqual({
        kind: 'domain',
        value: 'example.com',
      });
      expect(service.FromAdGuard('||sub.example.com^', false)).toEqual({
        kind: 'domain',
        value: 'sub.example.com',
      });
      expect(service.FromAdGuard('||example.com:8080^', false)).toEqual({
        kind: 'domain',
        value: 'example.com',
      });
    });

    it('normalizes urls', () => {
      expect(
        service.FromUrlOrIp('https://example.com/path?x=1', false),
      ).toEqual({ kind: 'domain', value: 'example.com' });
      expect(service.FromUrlOrIp('http://example.com:8080/', false)).toEqual({
        kind: 'domain',
        value: 'example.com',
      });
    });

    it('lowercases and trims trailing dots', () => {
      expect(service.FromUrlOrIp('ExAmPle.COM.', false)).toEqual({
        kind: 'domain',
        value: 'example.com',
      });
    });

    it('converts idn domains to punycode', () => {
      expect(service.FromUrlOrIp('münchen.de', false)).toEqual({
        kind: 'domain',
        value: 'xn--mnchen-3ya.de',
      });
    });

    it('ignores reserved host names', () => {
      expect(service.FromUrlOrIp('localhost', false)).toBeNull();
      expect(service.FromUrlOrIp('broadcasthost', false)).toBeNull();
    });
  });

  describe('allow rules', () => {
    it('drops exceptions in block context', () => {
      expect(service.FromAdGuard('@@||example.com^', false)).toBeNull();
    });

    it('keeps exceptions in allow context', () => {
      expect(service.FromAdGuard('@@||example.com^$important', true)).toEqual({
        kind: 'domain',
        value: 'example.com',
      });
    });
  });

  describe('cosmetic and directive rules', () => {
    it('skips cosmetic filters', () => {
      expect(service.FromAdGuard('example.com##.selector', false)).toBeNull();
      expect(service.FromAdGuard('example.com#@#.selector', false)).toBeNull();
      expect(service.FromAdGuard('example.org#?#div', false)).toBeNull();
      expect(service.FromAdGuard('example.org#$#body{}', false)).toBeNull();
      expect(service.FromAdGuard('example.org#@$#body{}', false)).toBeNull();
    });

    it('skips scriptlets', () => {
      expect(
        service.FromAdGuard('example.com#%#//scriptlet("x")', false),
      ).toBeNull();
      expect(service.FromAdGuard('example.com#+js(x)', false)).toBeNull();
    });

    it('skips comments, headers and regexes', () => {
      expect(service.FromAdGuard('! comment', false)).toBeNull();
      expect(service.FromAdGuard('[Adblock Plus 2.0]', false)).toBeNull();
      expect(service.FromAdGuard('/^ads?[0-9]/', false)).toBeNull();
      expect(service.FromAdGuard('# comment', false)).toBeNull();
    });
  });

  describe('ips and cidrs', () => {
    it('classifies ipv4 addresses', () => {
      expect(service.FromUrlOrIp('1.2.3.4', false)).toEqual({
        kind: 'ip',
        value: '1.2.3.4',
      });
    });

    it('classifies ipv6 addresses', () => {
      expect(service.FromUrlOrIp('2001:db8::1', false)).toEqual({
        kind: 'ip',
        value: '2001:db8::1',
      });
    });

    it('classifies ipv4 cidrs', () => {
      expect(service.FromUrlOrIp('10.0.0.0/8', false)).toEqual({
        kind: 'cidr',
        value: '10.0.0.0/8',
      });
    });

    it('classifies ipv6 cidrs', () => {
      expect(service.FromUrlOrIp('2001:db8::/32', false)).toEqual({
        kind: 'cidr',
        value: '2001:db8::/32',
      });
    });

    it('rejects out of range prefixes', () => {
      expect(service.FromUrlOrIp('10.0.0.0/33', false)).toBeNull();
      expect(service.FromUrlOrIp('2001:db8::/129', false)).toBeNull();
    });

    it('does not confuse paths with cidrs', () => {
      expect(service.FromUrlOrIp('example.com/24', false)).toEqual({
        kind: 'domain',
        value: 'example.com',
      });
    });
  });
});
