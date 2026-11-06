/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { jmapMapToArray } from '@/lib/jmapUtils';
import type { TraceEvent, TraceKeyValue, TraceValue } from './types';

export function normalizeTraceValue(raw: unknown): TraceValue {
  if (!raw || typeof raw !== 'object') return { '@type': 'Null' };
  const obj = raw as Record<string, unknown>;
  if (obj['@type'] === 'List') {
    return { '@type': 'List', value: jmapMapToArray<unknown>(obj.value).map(normalizeTraceValue) };
  }
  if (obj['@type'] === 'Event') {
    return { '@type': 'Event', event: String(obj.event ?? ''), value: normalizeKeyValues(obj.value) };
  }
  if (typeof obj['@type'] !== 'string') return { '@type': 'Null' };
  if (!isValidScalar(obj['@type'], obj.value)) return { '@type': 'String', value: jsonText(obj.value) };
  return raw as TraceValue;
}

function isValidScalar(type: string, value: unknown): boolean {
  switch (type) {
    case 'String':
    case 'IpAddr':
    case 'UTCDateTime':
      return typeof value === 'string';
    case 'UnsignedInt':
    case 'Integer':
      return (
        typeof value === 'number' ||
        typeof value === 'string' ||
        (!!value && typeof value === 'object' && typeof (value as Record<string, unknown>).source === 'string')
      );
    case 'Boolean':
      return typeof value === 'boolean';
    case 'Float':
    case 'Duration':
      return typeof value === 'number';
    default:
      return true;
  }
}

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

export function normalizeKeyValues(raw: unknown): TraceKeyValue[] {
  return jmapMapToArray<Record<string, unknown> | null>(raw)
    .filter((kv): kv is Record<string, unknown> => !!kv && typeof kv === 'object')
    .map((kv) => ({ key: String(kv.key ?? ''), value: normalizeTraceValue(kv.value) }));
}

function normalizeTraceEvent(evt: Record<string, unknown>): TraceEvent {
  return {
    event: String(evt.event ?? ''),
    timestamp: String(evt.timestamp ?? ''),
    keyValues: normalizeKeyValues(evt.keyValues),
  };
}

export function normalizeTraceEvents(raw: unknown): TraceEvent[] {
  return jmapMapToArray<Record<string, unknown> | null>(raw)
    .filter((evt): evt is Record<string, unknown> => !!evt && typeof evt === 'object')
    .map(normalizeTraceEvent);
}

function isRawTraceEvent(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.event === 'string' && typeof obj.timestamp === 'string';
}

export function parseTraceBatch(data: string): TraceEvent[] {
  const parsed: unknown = JSON.parse(data);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (!items.every(isRawTraceEvent)) throw new TypeError('Unexpected trace event payload');
  return items.map(normalizeTraceEvent);
}
