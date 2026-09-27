import { describe, expect, it } from 'vitest';
import { assertNoDevelopmentTokenInBuild, getDevelopmentAccessToken } from './devAccessToken';

describe('getDevelopmentAccessToken', () => {
  it('returns a configured token during development', () => {
    expect(getDevelopmentAccessToken(true, ' development-token ')).toBe('development-token');
  });

  it('ignores the configured token outside development', () => {
    expect(getDevelopmentAccessToken(false, 'development-token')).toBeUndefined();
  });

  it('ignores an empty token', () => {
    expect(getDevelopmentAccessToken(true, '  ')).toBeUndefined();
  });
});

describe('assertNoDevelopmentTokenInBuild', () => {
  it('rejects a configured token for production builds without revealing its value', () => {
    expect(() => assertNoDevelopmentTokenInBuild('build', 'development-token')).toThrow(
      'VITE_ACCESS_TOKEN is supported only by the Vite development server; remove it before building.',
    );
  });

  it('allows a build when the token is absent or when Vite is serving', () => {
    expect(() => assertNoDevelopmentTokenInBuild('build', undefined)).not.toThrow();
    expect(() => assertNoDevelopmentTokenInBuild('serve', 'development-token')).not.toThrow();
  });
});
