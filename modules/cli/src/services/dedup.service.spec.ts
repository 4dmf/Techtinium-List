import { describe, expect, it } from '@jest/globals';
import { DedupService } from './dedup.service';

describe('DedupService', () => {
  const service = new DedupService();

  it('collapses subdomains into a known parent', () => {
    const input = new Map([
      ['example.com', 'a'],
      ['ads.example.com', 'b'],
      ['track.example.com', 'c'],
      ['other.test', 'd'],
    ]);

    const output = service.process(input);

    expect([...output.keys()]).toEqual(['example.com', 'other.test']);
    expect(output.get('example.com')).toBe('a');
  });

  it('collapses a 3-label subdomain into its 2-label parent', () => {
    const input = new Map([
      ['example.com', 'a'],
      ['ads.example.com', 'b'],
    ]);

    const output = service.process(input);

    expect([...output.keys()]).toEqual(['example.com']);
    expect(output.get('example.com')).toBe('a');
  });

  it('collapses a 4-label subdomain into its 3-label parent', () => {
    const input = new Map([
      ['b.example.com', 'a'],
      ['a.b.example.com', 'b'],
    ]);

    const output = service.process(input);

    expect([...output.keys()]).toEqual(['b.example.com']);
    expect(output.get('b.example.com')).toBe('a');
  });

  it('walks every label and removes skip-level subdomains too', () => {
    const input = new Map([
      ['example.com', 'a'],
      ['a.b.c.example.com', 'b'],
    ]);

    const output = service.process(input);

    expect([...output.keys()]).toEqual(['example.com']);
  });

  it('collapses deep chains to the shortest ancestor', () => {
    const input = new Map([
      ['a.b.c.example.com', 'a'],
      ['b.c.example.com', 'b'],
      ['c.example.com', 'c'],
      ['example.com', 'd'],
    ]);

    const output = service.process(input);

    expect([...output.keys()]).toEqual(['example.com']);
  });

  it('keeps unrelated subdomains', () => {
    const input = new Map([
      ['ads.example.com', 'a'],
      ['track.example.org', 'b'],
    ]);

    const output = service.process(input);

    expect([...output.keys()]).toEqual([
      'ads.example.com',
      'track.example.org',
    ]);
  });

  it('sorts output deterministically', () => {
    const input = new Map([
      ['zeta.com', 'a'],
      ['alpha.com', 'b'],
      ['mid.com', 'c'],
    ]);

    const output = service.process(input);

    expect([...output.keys()]).toEqual(['alpha.com', 'mid.com', 'zeta.com']);
  });

  it('removes entries covered by an allow list', () => {
    const rules = new Map([
      ['ads.example.com', 'a'],
      ['example.com', 'b'],
      ['track.other.test', 'd'],
    ]);
    const allowed = new Set(['example.com']);

    const output = service.removeCoveredBy(rules, allowed);

    expect([...output.keys()]).toEqual(['track.other.test']);
  });

  it('removes exact allow matches and keeps unrelated domains', () => {
    const rules = new Map([
      ['allowed.com', 'a'],
      ['blocked.net', 'b'],
      ['sub.allowed.com', 'c'],
    ]);
    const allowed = new Set(['allowed.com', 'something.else']);

    const output = service.removeCoveredBy(rules, allowed);

    expect([...output.keys()]).toEqual(['blocked.net']);
  });

  it('preserves origin of surviving entries', () => {
    const input = new Map([
      ['example.com', 'source-a'],
      ['ads.example.com', 'source-b'],
    ]);

    const output = service.process(input);

    expect(output.get('example.com')).toBe('source-a');
  });
});
