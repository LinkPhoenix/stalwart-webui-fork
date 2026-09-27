import { describe, expect, it } from 'vitest';
import { isValidReleaseTag } from './validate-release-tag.mjs';

describe('isValidReleaseTag', () => {
  it.each(['v0.0.0', 'v1.2.3', 'v12.34.56'])('accepts stable SemVer tag %s', (tag) => {
    expect(isValidReleaseTag(tag)).toBe(true);
  });

  it.each(['1.2.3', 'v01.2.3', 'v1.2', 'v1.2.3-rc.1', 'v1.2.3|$(id)', 'v1.2.3\ncommand']) (
    'rejects invalid or command-bearing tag %s',
    (tag) => {
      expect(isValidReleaseTag(tag)).toBe(false);
    },
  );
});
