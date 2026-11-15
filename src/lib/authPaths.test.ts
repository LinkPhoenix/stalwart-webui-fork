/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';
import { isAuthPath, stripBasePath } from './authPaths';

describe('stripBasePath', () => {
  it('removes the deployment base path', () => {
    expect(stripBasePath('/admin/settings/x:Domain?sort=name', '/admin')).toBe('/settings/x:Domain?sort=name');
  });

  it('gives the root when nothing follows the base path', () => {
    expect(stripBasePath('/admin', '/admin')).toBe('/');
  });

  it('leaves the path alone without a base path or when it does not start with it', () => {
    expect(stripBasePath('/settings', '')).toBe('/settings');
    expect(stripBasePath('/other/settings', '/admin')).toBe('/other/settings');
  });
});

describe('isAuthPath', () => {
  it.each(['/login', '/login?returnUrl=%2Fx', '/oauth/callback', '/oauth/callback?code=1&state=2'])(
    'recognizes %s',
    (path) => {
      expect(isAuthPath(path)).toBe(true);
    },
  );

  it.each(['/', '/settings/x:Domain', '/loginfoo', '/login/extra', '/oauth/callbacks', '/x/login'])(
    'does not mistake %s for an auth route',
    (path) => {
      expect(isAuthPath(path)).toBe(false);
    },
  );
});
