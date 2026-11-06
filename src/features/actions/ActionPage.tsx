/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useSchemaStore } from '@/stores/schemaStore';
import { useHasObjectPermission, usePermissionCheckers } from '@/hooks/usePermissions';
import { useResolvedView } from '@/hooks/useResolvedView';
import { buildNewObjectValue } from '@/lib/schemaResolver';
import { useJmapSet } from '@/data/mutations';
import { errorMessage, friendlySetError } from '@/lib/jmapErrors';
import type { ObjectVariant } from '@/types/schema';
import { buildActionPayload, extraCreatedProperties, groupActions } from './actionModel';
import { ActionPicker } from './components/ActionPicker';
import { ActionForm } from './components/ActionForm';
import { ActionError, ActionResult } from './components/ActionResult';

type ActionState =
  | { kind: 'pick'; confirm: ObjectVariant | null }
  | { kind: 'form'; variant: ObjectVariant & { schemaName: string }; formData: Record<string, unknown> }
  | { kind: 'submitting'; variant: ObjectVariant }
  | { kind: 'result'; variant: ObjectVariant; data: Record<string, unknown> }
  | { kind: 'error'; variant: ObjectVariant; error: string };

const PICK: ActionState = { kind: 'pick', confirm: null };
const CREATE_ID = 'action-0';

interface ActionPageProps {
  viewName: string;
}

export function ActionPage({ viewName }: ActionPageProps) {
  const { t } = useTranslation();
  const schema = useSchemaStore((s) => s.schema);
  const resolved = useResolvedView(viewName);
  const { hasPermission } = usePermissionCheckers();
  const canCreate = useHasObjectPermission(resolved?.object.permissionPrefix, 'Create');
  const setMutation = useJmapSet(resolved?.object.objectName);
  const [state, setState] = useState<ActionState>(PICK);

  if (!schema || !resolved) return null;
  const { object, resolvedSchema, list } = resolved;

  const run = async (variant: ObjectVariant, payload: Record<string, unknown>, inputData: Record<string, unknown>) => {
    setState({ kind: 'submitting', variant });
    try {
      const result = await setMutation.mutateAsync({ create: { [CREATE_ID]: payload } });
      const failure = result.notCreated?.[CREATE_ID];
      if (failure) {
        setState({ kind: 'error', variant, error: friendlySetError(failure) });
        return;
      }
      const extra = extraCreatedProperties(result.created?.[CREATE_ID]);
      setState({ kind: 'result', variant, data: { ...inputData, ...extra } });
    } catch (e) {
      setState({ kind: 'error', variant, error: errorMessage(e, t('actions.actionFailed', 'Action failed.')) });
    }
  };

  const pick = (variant: ObjectVariant) => {
    const { schemaName } = variant;
    if (!schemaName) {
      setState({ kind: 'pick', confirm: variant });
      return;
    }
    const formData = buildNewObjectValue(schema, object.objectName, variant.name);
    delete formData['@type'];
    setState({ kind: 'form', variant: { ...variant, schemaName }, formData });
  };

  switch (state.kind) {
    case 'pick': {
      const variants = resolvedSchema.type === 'multiple' ? resolvedSchema.variants : [];
      const groups = groupActions(variants, (v) => hasPermission(`action${v.name}`), t('actions.otherGroup', 'Other'));
      const pending = state.confirm;
      return (
        <>
          <ActionPicker
            title={list?.title ?? t('actions.title', 'Actions')}
            subtitle={list?.subtitle ?? object.objectType.description}
            groups={groups}
            disabled={!canCreate}
            onPick={pick}
          />
          <ConfirmDialog
            open={pending !== null}
            onOpenChange={(open) => {
              if (!open) setState((prev) => (prev.kind === 'pick' ? PICK : prev));
            }}
            title={t('actions.confirmTitle', 'Run this action?')}
            description={pending?.label}
            confirmLabel={t('actions.execute', 'Execute')}
            onConfirm={() => {
              if (pending) void run(pending, buildActionPayload(pending.name, null, {}), {});
            }}
          />
        </>
      );
    }
    case 'form':
      return (
        <ActionForm
          schema={schema}
          variant={state.variant}
          initialData={state.formData}
          onBack={() => setState(PICK)}
          onSubmit={(data) =>
            void run(
              state.variant,
              buildActionPayload(state.variant.name, schema.fields[state.variant.schemaName] ?? null, data),
              data,
            )
          }
        />
      );
    case 'submitting':
      return (
        <div role="status" className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-muted py-16">
          <Loader2 aria-hidden="true" className="size-8 animate-spin text-brand-text" />
          <p className="text-muted-foreground">
            {t('actions.executing', 'Executing {{label}}...', { label: state.variant.label })}
          </p>
        </div>
      );
    case 'result':
      return (
        <ActionResult schema={schema} variant={state.variant} data={state.data} onNewAction={() => setState(PICK)} />
      );
    case 'error':
      return <ActionError error={state.error} onBack={() => setState(PICK)} />;
  }
}
