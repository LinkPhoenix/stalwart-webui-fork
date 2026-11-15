/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

/** Removes the deployment base path (for example `/admin`) so the rest can be compared with route paths. */
export function stripBasePath(path: string, basePath: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

/**
 * True for the sign-in and OAuth callback routes, given a path without the base path. Returning to one of them
 * after signing in would loop, so callers send the user to the home page instead.
 */
export function isAuthPath(path: string): boolean {
  return (
    path === '/login' || path.startsWith('/login?') || path === '/oauth/callback' || path.startsWith('/oauth/callback?')
  );
}
