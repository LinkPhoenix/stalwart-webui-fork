/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSchemaStore } from '@/stores/schemaStore';
import { resolveObject, resolveList } from '@/lib/schemaResolver';
import { coerceLabel } from '@/lib/objectOptions';
import { jmapGet, getAccountId } from '@/services/jmap/client';
import { DynamicView } from './DynamicView';

interface DynamicViewPageProps {
  viewName: string;
  objectId: string;
}

export function DynamicViewPage({ viewName, objectId }: DynamicViewPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schema = useSchemaStore((s) => s.schema);
  const viewToSection = useSchemaStore((s) => s.viewToSection);
  const listPath = viewToSection[viewName] ? `/${viewToSection[viewName]}/${viewName}` : null;
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schema) return;
    let cancelled = false;

    async function load() {
      try {
        const resolved = resolveObject(schema!, viewName);
        if (!resolved) throw new Error(t('view.couldNotResolve', 'Could not resolve object'));

        const accountId = getAccountId(resolved.objectName);
        const responses = await jmapGet(resolved.objectName, accountId, [objectId]);

        if (cancelled) return;

        const getResult = responses.find(([name]) => name.endsWith('/get'));
        if (!getResult) throw new Error(t('view.noGetResponse', 'No get response'));

        const result = getResult[1] as { list?: Array<Record<string, unknown>> };
        const item = result.list?.[0];
        if (!item) throw new Error(t('view.objectNotFound', 'Object not found'));

        setData(item);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('view.failedToLoad', 'Failed to load'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [schema, viewName, objectId, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const backButton = listPath ? (
    <Button variant="outline" size="sm" asChild>
      <Link to={listPath}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('common.back', 'Back')}
      </Link>
    </Button>
  ) : (
    <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      {t('common.back', 'Back')}
    </Button>
  );

  if (error || !data || !schema) {
    return (
      <div className="space-y-4">
        {backButton}
        <div className="text-destructive p-4">{error ?? t('view.failedToLoad', 'Failed to load')}</div>
      </div>
    );
  }

  const resolved = resolveObject(schema, viewName);
  if (!resolved) return null;

  const list = resolveList(schema, viewName, resolved.objectName);
  const labelProp = list?.labelProperty ?? list?.columns?.[0]?.name;
  const rawLabel = labelProp ? coerceLabel(data[labelProp], '') : '';
  const displayName = rawLabel.length > 0 ? rawLabel : undefined;
  const singularName = list?.singularName ?? resolved.objectName.replace(/^x:/, '');
  const title = displayName
    ? `${singularName.charAt(0).toUpperCase() + singularName.slice(1)}: ${displayName}`
    : singularName.charAt(0).toUpperCase() + singularName.slice(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {backButton}
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>

      <DynamicView schema={schema} objectName={resolved.objectName} viewName={viewName} data={data} />
    </div>
  );
}
