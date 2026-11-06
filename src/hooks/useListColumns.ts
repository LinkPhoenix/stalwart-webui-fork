import { useState } from 'react';

import {
  moveListColumn,
  parseListColumnPreferences,
  type ListColumnPreferences,
} from '@/lib/listColumnPreferences';
import type { Column } from '@/types/schema';

const storageKey = (viewName: string) => `list-columns:${viewName}`;

function readPreferences(viewName: string): ListColumnPreferences {
  try {
    return parseListColumnPreferences(localStorage.getItem(storageKey(viewName)));
  } catch {
    return { order: [], hidden: [] };
  }
}

export interface ListColumns {
  /** Every column the list offers, in schema order. */
  all: Column[];
  /** Columns to show, honouring the saved visibility and order. */
  visible: Column[];
  hidden: ReadonlySet<string>;
  setVisible: (name: string, visible: boolean) => void;
  move: (name: string, direction: -1 | 1) => void;
}

/** Per-list column visibility and order, saved in localStorage per view. */
export function useListColumns(viewName: string, columns: Column[]): ListColumns {
  const [state, setState] = useState(() => ({ viewName, value: readPreferences(viewName) }));
  const preferences = state.viewName === viewName ? state.value : readPreferences(viewName);

  const save = (next: ListColumnPreferences) => {
    setState({ viewName, value: next });
    try {
      localStorage.setItem(storageKey(viewName), JSON.stringify(next));
    } catch {
      // Keep the list usable when browser storage is unavailable.
    }
  };

  const orderIndex = new Map(preferences.order.map((name, index) => [name, index]));
  const visible = columns
    .filter((column) => !preferences.hidden.includes(column.name))
    .sort(
      (a, b) =>
        (orderIndex.get(a.name) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(b.name) ?? Number.MAX_SAFE_INTEGER),
    );

  return {
    all: columns,
    visible,
    hidden: new Set(preferences.hidden),
    setVisible: (name, show) =>
      save({
        ...preferences,
        hidden: show ? preferences.hidden.filter((entry) => entry !== name) : [...preferences.hidden, name],
      }),
    move: (name, direction) => {
      const order = visible.map((column) => column.name);
      const next = moveListColumn(order, name, direction);
      if (next !== order) save({ ...preferences, order: next });
    },
  };
}
