/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EnterpriseUpsell } from '@/components/common/EnterpriseUpsell';
import { useIsCommunity, usePermissionCheckers } from '@/hooks/usePermissions';
import { useResolvedView } from '@/hooks/useResolvedView';
import { layoutViewFor } from '@/lib/layout';
import { canAccessView } from '@/lib/permissions';
import { getDisplayProperty } from '@/lib/schemaResolver';
import { useSchemaStore } from '@/stores/schemaStore';
import type { List, Schema } from '@/types/schema';
import type { ResolvedView } from '@/lib/schemaResolver';

import { FilterBar } from './FilterBar';
import { ListTable } from './ListTable';
import { ListError, ListMessage, ListSpinner } from './ListStates';
import { MassActionBar, type RunnableMassAction } from './MassActionBar';
import { Pagination } from './Pagination';
import { RowActions } from './RowActions';
import { SelectionBanner } from './SelectionBanner';
import { itemActionHref, resolveItemActions, resolveMassActions, type ResolvedItemAction } from './listActions';
import { getListFields, itemId, itemLabel } from './listQuery';
import { useDynamicList } from './useDynamicList';
import { useListActions } from './useListActions';
import { useListSelection } from './useListSelection';

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => Promise<unknown>;
}

interface DynamicListProps {
  viewName: string;
}

export function DynamicList({ viewName }: DynamicListProps) {
  const { t } = useTranslation();
  const schema = useSchemaStore((s) => s.schema);
  const resolved = useResolvedView(viewName);

  if (!schema) return <ListSpinner />;
  if (!resolved) return <ListMessage>{t('errors.viewNotFound', 'View not found')}</ListMessage>;
  if (!resolved.list)
    return <ListMessage>{t('list.noListConfigured', 'This view has no list configured.')}</ListMessage>;

  return <DynamicListView viewName={viewName} schema={schema} resolved={resolved} list={resolved.list} />;
}

interface DynamicListViewProps {
  viewName: string;
  schema: Schema;
  resolved: ResolvedView;
  list: List;
}

function DynamicListView({ viewName, schema, resolved, list }: DynamicListViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const viewToSection = useSchemaStore((s) => s.viewToSection);
  const checkers = usePermissionCheckers();
  const isCommunity = useIsCommunity();
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const obj = resolved.object;
  const objectName = obj.objectName;
  const fields = getListFields(resolved.resolvedSchema);
  const labelProperty = getDisplayProperty(schema, viewName);
  const listState = useDynamicList(objectName, list, labelProperty in fields ? labelProperty : undefined);
  const actions = useListActions(objectName);
  const { items, total, state } = listState;
  const pageIds = items.flatMap((item) => {
    const id = itemId(item);
    return id ? [id] : [];
  });
  const selection = useListSelection(listState.stateKey, pageIds);

  const section = viewToSection[viewName];

  const isObject = obj.objectType.type === 'object';
  const canCreate = isObject && checkers.hasObjectPermission(obj.permissionPrefix, 'Create');
  const massActions = resolveMassActions(
    list.massActions,
    { isObject, permissionPrefix: obj.permissionPrefix },
    checkers,
    t('list.delete', 'Delete'),
  );
  const itemActions = resolveItemActions(schema, list.itemActions, obj.permissionPrefix, {
    hasObjectPermission: checkers.hasObjectPermission,
    isCommunity,
  });
  const visibleFilters = (list.filters ?? []).filter(
    (f) => f.type !== 'objectId' || canAccessView(schema, f.objectName, 'Get', checkers),
  );

  const busy = listState.isFetching || actions.pending;
  const selectedCount = selection.allMatching ? (total ?? selection.selectedIds.length) : selection.selectedIds.length;
  const nameFor = (count: number) => (count === 1 ? list.singularName : list.pluralName);

  const confirmMassAction = (action: RunnableMassAction) => {
    const count = selectedCount;
    const name = nameFor(count);
    const allMatching = selection.allMatching;
    const run = async () => {
      const ok = await actions.runMassAction(action, {
        ids: selection.selectedIds,
        allMatching,
        filter: listState.jmapFilter,
        sort: listState.jmapSort,
      });
      if (ok) selection.clear();
    };
    if (action.type === 'delete') {
      setConfirm({
        title: allMatching
          ? t('list.deleteAllMatchingTitle', 'Delete all matching {{name}}', { name: list.pluralName })
          : t('list.deleteManyTitle', 'Delete {{count}} {{name}}', { count, name }),
        description: allMatching
          ? t(
              'list.deleteAllMatchingDescription',
              'Are you sure you want to delete ALL {{name}} matching the current filters? This action cannot be undone.',
              { name: list.pluralName },
            )
          : t(
              'list.deleteManyDescription',
              'Are you sure you want to delete {{count}} {{name}}? This action cannot be undone.',
              {
                count,
                name,
              },
            ),
        confirmLabel: t('list.deleteAll', 'Delete all'),
        destructive: true,
        onConfirm: run,
      });
      return;
    }
    setConfirm({
      title: t('list.confirmTitle', 'Confirm Action'),
      description: t('list.confirmMassDescription', 'Apply "{{action}}" to {{count}} {{name}}?', {
        action: action.label,
        count,
        name,
      }),
      confirmLabel: action.label,
      destructive: false,
      onConfirm: run,
    });
  };

  const confirmItemAction = (entry: Extract<ResolvedItemAction, { kind: 'mutation' }>, id: string, label: string) => {
    const { action } = entry;
    const run = async () => {
      const ok = await actions.runItemAction(action, id);
      if (ok && action.type === 'delete') selection.deselect(id);
    };
    if (action.type === 'delete') {
      setConfirm({
        title: t('list.deleteItemTitle', 'Delete {{name}}?', { name: list.singularName }),
        description: t(
          'list.deleteItemDescription',
          'Are you sure you want to delete {{label}}? This action cannot be undone.',
          { label },
        ),
        confirmLabel: t('list.delete', 'Delete'),
        destructive: true,
        onConfirm: run,
      });
      return;
    }
    setConfirm({
      title: t('list.confirmTitle', 'Confirm Action'),
      description: t('list.confirmItemDescription', 'Apply "{{action}}" to {{label}}?', {
        action: action.label,
        label,
      }),
      confirmLabel: action.label,
      destructive: false,
      onConfirm: run,
    });
  };

  const sectionFor = (name: string) => viewToSection[name];
  const viewFor = (name: string) => layoutViewFor(schema, viewToSection, name, viewName);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1 pt-3">
        <div className="min-w-0">
          <h1 className="page-title">{list.title}</h1>
          {list.subtitle && <p className="mt-1 text-sm text-muted-foreground">{list.subtitle}</p>}
        </div>
        {canCreate && section && (
          <Button onClick={() => navigate(`/${section}/${viewName}/new`)}>
            <Plus aria-hidden />
            {t('list.create', 'Create {{name}}', { name: list.singularName })}
          </Button>
        )}
      </div>

      {listState.error && <ListError message={listState.error} onRetry={listState.refetch} />}
      {actions.error && <ListError message={actions.error} onDismiss={actions.clearError} />}

      <section className="tile relative overflow-hidden">
        {visibleFilters.length > 0 && (
          <FilterBar
            schema={schema}
            filters={visibleFilters}
            applied={state.filters}
            isXPrefixed={objectName.startsWith('x:')}
            disabled={listState.isFetching}
            onApply={listState.applyFilters}
            onReset={listState.resetFilters}
          />
        )}

        {massActions.length > 0 && selection.pageState === 'all' && (
          <SelectionBanner
            allMatching={selection.allMatching}
            pageCount={selection.selectedIds.length}
            total={total}
            pluralName={list.pluralName}
            onSelectAllMatching={selection.selectAllMatching}
            onClear={selection.clear}
          />
        )}

        <ListTable
          caption={list.title}
          columns={list.columns}
          fields={fields}
          items={items}
          schema={schema}
          objectName={objectName}
          sort={state.sort}
          sortable={new Set(list.sort ?? [])}
          onSort={listState.toggleSort}
          selection={massActions.length > 0 ? selection : null}
          rowHref={(id) => (section ? `/${section}/${viewName}/${id}` : null)}
          rowLabel={(item) => itemLabel(item, labelProperty)}
          renderRowActions={
            itemActions.length > 0
              ? (_item, id, label) => (
                  <RowActions
                    actions={itemActions}
                    label={label}
                    hrefFor={(action) => itemActionHref(action, id, sectionFor, section, viewFor)}
                    onMutation={(entry) => confirmItemAction(entry, id, label)}
                    onLocked={() => setUpsellOpen(true)}
                    disabled={actions.pending}
                  />
                )
              : null
          }
          loading={listState.isLoading}
          busy={busy}
        />

        {(items.length > 0 || state.anchors.length > 0) && (
          <Pagination
            range={listState.range}
            total={total}
            count={items.length}
            pluralName={list.pluralName}
            disabled={listState.isFetching}
            onPrev={listState.prevPage}
            onNext={listState.nextPage}
          />
        )}

        {busy && items.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/50" aria-hidden>
            <Loader2 className="h-6 w-6 animate-spin text-brand-text" />
          </div>
        )}
      </section>

      {massActions.length > 0 && selectedCount > 0 && (
        <MassActionBar
          actions={massActions}
          count={selectedCount}
          disabled={actions.pending}
          onSelect={confirmMassAction}
          onClear={selection.clear}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm?.title ?? ''}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        variant={confirm?.destructive ? 'destructive' : 'default'}
        onConfirm={() => confirm?.onConfirm()}
      />

      <EnterpriseUpsell open={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </div>
  );
}
