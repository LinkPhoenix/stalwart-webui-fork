/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useJmapBulkSet, useJmapSet, type BulkTarget } from '@/data/mutations';
import { toast } from '@/hooks/use-toast';
import {
  bulkResultSummary,
  destroyedOutcome,
  errorMessage,
  friendlySetError,
  updatedOutcome,
  type SetOutcome,
} from '@/lib/jmapErrors';
import type { ItemAction } from '@/types/schema';
import type { RunnableMassAction } from './MassActionBar';

type MutationItemAction = Extract<ItemAction, { type: 'delete' | 'setProperty' }>;

export interface MassActionTarget {
  ids: string[];
  allMatching: boolean;
  filter: Record<string, unknown> | undefined;
  sort: Record<string, unknown>[] | undefined;
}

export interface ListActions {
  error: string | null;
  pending: boolean;
  clearError: () => void;
  runItemAction: (action: MutationItemAction, id: string) => Promise<boolean>;
  runMassAction: (action: RunnableMassAction, target: MassActionTarget) => Promise<boolean>;
}

function reportOutcome(outcome: SetOutcome, kind: 'delete' | 'update') {
  const failures = Object.keys(outcome.failed).length > 0 ? outcome.failed : null;
  const summary = bulkResultSummary(outcome.succeeded.length, failures, kind);
  if (summary) toast({ title: summary.title, description: summary.description, variant: summary.variant });
}

export function useListActions(objectName: string | undefined): ListActions {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const setMutation = useJmapSet(objectName);
  const bulkMutation = useJmapBulkSet(objectName);

  const runItemAction = async (action: MutationItemAction, id: string): Promise<boolean> => {
    setError(null);
    try {
      if (action.type === 'delete') {
        const outcome = destroyedOutcome(await setMutation.mutateAsync({ destroy: [id] }));
        const failure = outcome.failed[id];
        if (failure) {
          setError(friendlySetError(failure));
          return false;
        }
        if (!outcome.succeeded.includes(id)) {
          setError(t('list.deleteNotConfirmed', 'Delete failed: item was not confirmed as destroyed by the server.'));
          return false;
        }
        reportOutcome(outcome, 'delete');
        return true;
      }
      const outcome = updatedOutcome(await setMutation.mutateAsync({ update: { [id]: action.properties } }));
      const failure = outcome.failed[id];
      if (failure) {
        setError(friendlySetError(failure));
        return false;
      }
      reportOutcome(outcome, 'update');
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  };

  const runMassAction = async (action: RunnableMassAction, target: MassActionTarget): Promise<boolean> => {
    setError(null);
    const bulkTarget: BulkTarget = target.allMatching
      ? { query: { filter: target.filter, sort: target.sort } }
      : { ids: target.ids };
    try {
      const outcome =
        action.type === 'delete'
          ? await bulkMutation.mutateAsync({ ...bulkTarget, action: 'destroy' })
          : await bulkMutation.mutateAsync({ ...bulkTarget, action: 'update', patch: action.properties });
      reportOutcome(outcome, action.type === 'delete' ? 'delete' : 'update');
      return Object.keys(outcome.failed).length === 0;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  };

  return {
    error,
    pending: setMutation.isPending || bulkMutation.isPending,
    clearError: () => setError(null),
    runItemAction,
    runMassAction,
  };
}
