import { describe, expect, it } from 'vitest';
import { resolveLucideIconName } from './lucideIconName';

describe('resolveLucideIconName', () => {
  it('accepts official kebab-case icon names', () => {
    expect(resolveLucideIconName('users-round')).toBe('users-round');
  });

  it('normalizes PascalCase icon names', () => {
    expect(resolveLucideIconName('HelpCircle')).toBe('help-circle');
  });

  it('rejects unsupported icon names', () => {
    expect(resolveLucideIconName('not-an-icon')).toBeNull();
  });
});
