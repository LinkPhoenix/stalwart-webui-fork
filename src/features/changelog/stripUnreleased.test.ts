/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';

import { stripUnreleasedChangelog } from './stripUnreleased';

describe('stripUnreleasedChangelog', () => {
  it('removes an empty Unreleased section', () => {
    const input = `# Change Log

## [Unreleased]

## [1.1.4] - 2026-08-04

### Fixed
- Something.
`;
    expect(stripUnreleasedChangelog(input)).toBe(`# Change Log

## [1.1.4] - 2026-08-04

### Fixed
- Something.
`);
  });

  it('removes Unreleased content so it never appears in the UI', () => {
    const input = `# Change Log

## [Unreleased]

### Fixed
- WIP that must not show.

## [1.0.0] - 2026-01-01

### Added
- Initial release.
`;
    const result = stripUnreleasedChangelog(input);
    expect(result).not.toMatch(/Unreleased/i);
    expect(result).not.toContain('WIP that must not show');
    expect(result).toContain('## [1.0.0] - 2026-01-01');
    expect(result).toContain('Initial release');
  });

  it('leaves changelogs without Unreleased unchanged (aside from trailing newline)', () => {
    const input = `# Change Log

## [1.0.0] - 2026-01-01

### Added
- Ship it.
`;
    expect(stripUnreleasedChangelog(input)).toBe(input);
  });
});
