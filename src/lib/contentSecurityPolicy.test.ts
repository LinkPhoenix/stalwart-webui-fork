/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy } from './contentSecurityPolicy';

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((part) => {
      const [name, ...sources] = part.split(' ');
      return [name, sources] as const;
    }),
  );
}

describe('buildContentSecurityPolicy', () => {
  it('only runs scripts bundled with the application', () => {
    const scriptSources = directives(buildContentSecurityPolicy()).get('script-src');
    expect(scriptSources).toEqual(["'self'"]);
  });

  it('never allows eval or inline scripts anywhere', () => {
    const policy = buildContentSecurityPolicy('https://mail.example.test');
    expect(policy).not.toContain('unsafe-eval');
    const inlineAllowed = [...directives(policy)].filter(([, sources]) => sources.includes("'unsafe-inline'"));
    expect(inlineAllowed.map(([name]) => name)).toEqual(['style-src']);
  });

  it('forbids plugins and restricts base and form targets', () => {
    const parsed = directives(buildContentSecurityPolicy());
    expect(parsed.get('object-src')).toEqual(["'none'"]);
    expect(parsed.get('base-uri')).toEqual(["'self'"]);
    expect(parsed.get('form-action')).toEqual(["'self'"]);
  });

  it('allows the data and blob images the application creates itself', () => {
    expect(directives(buildContentSecurityPolicy()).get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
  });

  it('adds a plain-HTTP API origin to connections and images', () => {
    const parsed = directives(buildContentSecurityPolicy('http://localhost:8080/ignored/path'));
    expect(parsed.get('connect-src')).toEqual(["'self'", 'https:', 'http://localhost:8080']);
    expect(parsed.get('img-src')).toContain('http://localhost:8080');
  });

  it('does not repeat an HTTPS API origin already covered by https:', () => {
    const parsed = directives(buildContentSecurityPolicy('https://mail.example.test'));
    expect(parsed.get('connect-src')).toEqual(["'self'", 'https:']);
    expect(parsed.get('img-src')).toContain('https://mail.example.test');
  });

  it('ignores an empty or malformed API base URL', () => {
    const expected = buildContentSecurityPolicy();
    expect(buildContentSecurityPolicy('')).toBe(expected);
    expect(buildContentSecurityPolicy('not a url')).toBe(expected);
  });
});
