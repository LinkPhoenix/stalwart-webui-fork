/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useSchemaStore } from '@/stores/schemaStore';
import { getEnum } from '@/lib/schemaResolver';
import type { Schema } from '@/types/schema';

export interface EventLabel {
  label: string;
  explanation?: string;
  known: boolean;
}

export interface TraceLabels {
  event: (eventType: string) => EventLabel;
  key: (key: string) => string;
}

const cache = new WeakMap<Schema, TraceLabels>();
const EMPTY_LABELS: TraceLabels = {
  event: (eventType) => ({ label: eventType, known: false }),
  key: (key) => key,
};

function buildLabels(schema: Schema): TraceLabels {
  const events = new Map(getEnum(schema, 'EventType').map((e) => [e.name, e]));
  const keys = new Map(getEnum(schema, 'Key').map((e) => [e.name, e.label]));
  return {
    event: (eventType) => {
      const entry = events.get(eventType);
      return entry
        ? { label: entry.label, explanation: entry.explanation, known: true }
        : { label: eventType, known: false };
    },
    key: (key) => keys.get(key) ?? key,
  };
}

export function traceLabelsFor(schema: Schema | null): TraceLabels {
  if (!schema) return EMPTY_LABELS;
  let labels = cache.get(schema);
  if (!labels) {
    labels = buildLabels(schema);
    cache.set(schema, labels);
  }
  return labels;
}

export function useTraceLabels(): TraceLabels {
  const schema = useSchemaStore((s) => s.schema);
  return traceLabelsFor(schema);
}
