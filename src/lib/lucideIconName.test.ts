import { describe, expect, it } from 'vitest';
import { resolveLucideIconName } from './lucideIconName';

const SUPPORTED = ['users-round', 'help-circle'];

describe('resolveLucideIconName', () => {
  it('accepts official kebab-case icon names', () => {
    expect(resolveLucideIconName(SUPPORTED, 'users-round')).toBe('users-round');
  });

  it('normalizes PascalCase icon names', () => {
    expect(resolveLucideIconName(SUPPORTED, 'HelpCircle')).toBe('help-circle');
  });

  it('accepts a Set of supported names', () => {
    expect(resolveLucideIconName(new Set(SUPPORTED), 'users-round')).toBe('users-round');
  });

  it('rejects unsupported icon names', () => {
    expect(resolveLucideIconName(SUPPORTED, 'not-an-icon')).toBeNull();
  });
});
