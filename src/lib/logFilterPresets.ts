/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

const STORAGE_KEY = 'stalwart-log-filter-presets';

export interface LogFilterPreset {
  id: string;
  name: string;
  filters: Record<string, string>;
}

function readAll(): LogFilterPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is LogFilterPreset =>
        p != null &&
        typeof p === 'object' &&
        typeof (p as LogFilterPreset).id === 'string' &&
        typeof (p as LogFilterPreset).name === 'string' &&
        (p as LogFilterPreset).filters != null &&
        typeof (p as LogFilterPreset).filters === 'object',
    );
  } catch {
    return [];
  }
}

function writeAll(presets: LogFilterPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage errors (e.g. private mode).
  }
}

export function listLogFilterPresets(): LogFilterPreset[] {
  return readAll();
}

export function saveLogFilterPreset(name: string, filters: Record<string, string>): LogFilterPreset {
  const trimmed = name.trim();
  const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
  const presets = readAll().filter((p) => p.name.toLowerCase() !== trimmed.toLowerCase());
  const preset: LogFilterPreset = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    filters: cleanFilters,
  };
  writeAll([preset, ...presets].slice(0, 20));
  return preset;
}

export function deleteLogFilterPreset(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id));
}
