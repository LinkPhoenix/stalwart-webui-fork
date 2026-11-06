/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';

interface SelectionState {
  scope: string;
  ids: ReadonlySet<string>;
  allMatching: boolean;
}

export type PageSelectionState = 'none' | 'some' | 'all';

export interface ListSelection {
  selectedIds: string[];
  allMatching: boolean;
  pageState: PageSelectionState;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  togglePage: () => void;
  selectAllMatching: () => void;
  clear: () => void;
  deselect: (id: string) => void;
}

const EMPTY_IDS: ReadonlySet<string> = new Set();

export function useListSelection(scope: string, pageIds: readonly string[]): ListSelection {
  const [raw, setRaw] = useState<SelectionState>({ scope, ids: EMPTY_IDS, allMatching: false });
  const current = raw.scope === scope ? raw : { scope, ids: EMPTY_IDS, allMatching: false };

  const selectedIds = pageIds.filter((id) => current.ids.has(id));
  const pageState: PageSelectionState =
    selectedIds.length === 0 ? 'none' : selectedIds.length === pageIds.length ? 'all' : 'some';

  const update = (fn: (prev: SelectionState) => SelectionState) =>
    setRaw((prev) => fn(prev.scope === scope ? prev : { scope, ids: EMPTY_IDS, allMatching: false }));

  return {
    selectedIds,
    allMatching: current.allMatching && pageState === 'all',
    pageState,
    isSelected: (id) => current.ids.has(id),
    toggle: (id) =>
      update((prev) => {
        const ids = new Set(prev.ids);
        if (ids.has(id)) ids.delete(id);
        else ids.add(id);
        return { scope, ids, allMatching: false };
      }),
    togglePage: () =>
      update(() => ({
        scope,
        ids: pageState === 'all' ? EMPTY_IDS : new Set(pageIds),
        allMatching: false,
      })),
    selectAllMatching: () => update(() => ({ scope, ids: new Set(pageIds), allMatching: true })),
    clear: () => update(() => ({ scope, ids: EMPTY_IDS, allMatching: false })),
    deselect: (id) =>
      update((prev) => {
        if (!prev.ids.has(id)) return prev;
        const ids = new Set(prev.ids);
        ids.delete(id);
        return { scope, ids, allMatching: false };
      }),
  };
}
