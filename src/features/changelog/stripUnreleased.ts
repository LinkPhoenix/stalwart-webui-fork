/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

/**
 * Drop the Keep-a-Changelog `## [Unreleased]` section so end users only see
 * published versions in the in-app Changelog page.
 */
export function stripUnreleasedChangelog(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (/^## \[Unreleased\]/.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && /^## \[/.test(line)) {
      skipping = false;
    }
    if (!skipping) {
      out.push(line);
    }
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n');
}
