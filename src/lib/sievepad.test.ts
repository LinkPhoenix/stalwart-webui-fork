/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';
import { sievepadLink } from './sievepad';

async function unpack(link: string): Promise<unknown> {
  const payload = link.split('#w=')[1].replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}

describe('sievepadLink', () => {
  it('packs the script into a share link that decodes back to the same content', async () => {
    const link = await sievepadLink(
      'Out of office',
      'require "vacation";\r\nvacation "away";',
      'https://pad.example.test/',
    );

    expect(link.startsWith('https://pad.example.test/#w=')).toBe(true);
    expect(link.split('#w=')[1]).not.toMatch(/[+/=]/);
    expect(await unpack(link)).toEqual({
      v: 1,
      name: 'Out of office',
      scripts: [{ name: 'main', source: 'require "vacation";\nvacation "away";' }],
      messages: [],
      settings: {},
    });
  });

  it('truncates a long script name', async () => {
    const link = await sievepadLink('x'.repeat(200), 'keep;', 'https://pad.example.test/');
    expect(((await unpack(link)) as { name: string }).name).toHaveLength(80);
  });
});
