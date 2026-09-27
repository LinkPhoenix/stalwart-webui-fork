/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { SIEVEPAD_URL, isSieveScriptField, sievepadLink } from './sievepad';

function decode(link: string): unknown {
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get('w') ?? '';
  return JSON.parse(inflateRawSync(Buffer.from(token, 'base64url')).toString('utf8'));
}

describe('sievepadLink', () => {
  it('encodes the script as a single main entry', async () => {
    const source = 'require "imap4flags";\r\naddflag "\\\\Seen";\r\n';
    const link = await sievepadLink('Filters é', source);

    expect(link.startsWith(`${SIEVEPAD_URL}#w=`)).toBe(true);
    expect(link.slice(`${SIEVEPAD_URL}#w=`.length)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decode(link)).toEqual({
      v: 1,
      name: 'Filters é',
      scripts: [{ name: 'main', source: 'require "imap4flags";\naddflag "\\\\Seen";\n' }],
      messages: [],
      settings: {},
    });
  });

  it('truncates long workspace names', async () => {
    const link = await sievepadLink('x'.repeat(200), 'keep;');
    expect((decode(link) as { name: string }).name).toHaveLength(80);
  });
});

describe('isSieveScriptField', () => {
  it('matches only the known script fields', () => {
    expect(isSieveScriptField('x:SieveUserScript', 'contents')).toBe(true);
    expect(isSieveScriptField('x:SieveSystemScript', 'contents')).toBe(true);
    expect(isSieveScriptField('SieveScript', 'blobId')).toBe(true);
    expect(isSieveScriptField('SieveScript', 'name')).toBe(false);
    expect(isSieveScriptField('x:Domain', 'contents')).toBe(false);
  });
});
