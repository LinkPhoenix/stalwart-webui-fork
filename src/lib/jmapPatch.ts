/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

export function calculateJmapPatch(
  original: Record<string, unknown>,
  modified: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(original), ...Object.keys(modified)]);

  const variantChanged =
    Object.hasOwn(original, '@type') && Object.hasOwn(modified, '@type') && original['@type'] !== modified['@type'];

  for (const key of allKeys) {
    if (key === 'id') {
      continue;
    }

    const origVal = original[key];
    const modVal = modified[key];

    if (!Object.hasOwn(original, key)) {
      if (modVal !== undefined) patch[key] = modVal;
      continue;
    }

    if (!Object.hasOwn(modified, key)) {
      if (variantChanged) continue;
      patch[key] = null;
      continue;
    }

    diffValues(key, origVal, modVal, patch);
  }

  return patch;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function escapeJsonPointerToken(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

function diffValues(prefix: string, origVal: unknown, modVal: unknown, patch: Record<string, unknown>): void {
  if (isPlainObject(origVal) && isPlainObject(modVal)) {
    const origType = origVal['@type'];
    const modType = modVal['@type'];
    if (origType !== modType) {
      patch[prefix] = modVal;
      return;
    }

    const allSubKeys = new Set([...Object.keys(origVal), ...Object.keys(modVal)]);

    for (const subKey of allSubKeys) {
      const path = `${prefix}/${escapeJsonPointerToken(subKey)}`;
      const origSub = origVal[subKey];
      const modSub = modVal[subKey];

      if (!Object.hasOwn(origVal, subKey)) {
        if (modSub !== undefined) patch[path] = modSub;
        continue;
      }

      if (!Object.hasOwn(modVal, subKey)) {
        patch[path] = null;
        continue;
      }

      diffValues(path, origSub, modSub, patch);
    }
    return;
  }

  if (Array.isArray(origVal) && Array.isArray(modVal)) {
    if (JSON.stringify(origVal) !== JSON.stringify(modVal)) {
      patch[prefix] = modVal;
    }
    return;
  }

  if (origVal !== modVal) {
    patch[prefix] = modVal === undefined ? null : modVal;
  }
}
