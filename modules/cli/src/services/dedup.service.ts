import { Injectable } from '@nestjs/common';

@Injectable()
export class DedupService {
  public process(rules: Map<string, string>): Map<string, string> {
    const known = new Set(rules.keys());
    const collapsed = new Map<string, string>();

    for (const [domain, origin] of rules) {
      if (this.hasKnownParent(domain, known)) {
        continue;
      }
      collapsed.set(domain, origin);
    }

    return new Map(
      [...collapsed.entries()].sort((left, right) => {
        if (left[0] < right[0]) {
          return -1;
        }
        if (left[0] > right[0]) {
          return 1;
        }
        return 0;
      }),
    );
  }

  public removeCoveredBy(
    rules: Map<string, string>,
    covered: Set<string>,
  ): Map<string, string> {
    const remaining = new Map<string, string>();

    for (const [domain, origin] of rules) {
      if (covered.has(domain) || this.hasKnownParent(domain, covered)) {
        continue;
      }
      remaining.set(domain, origin);
    }

    return remaining;
  }

  private hasKnownParent(domain: string, known: Set<string>): boolean {
    let index = domain.indexOf('.');

    while (index !== -1) {
      const parent = domain.slice(index + 1);
      if (known.has(parent)) {
        return true;
      }
      index = domain.indexOf('.', index + 1);
    }

    return false;
  }
}
