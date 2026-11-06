import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { fetchAllRowsQuery } from '@/data/listAll';
import { toast } from '@/hooks/use-toast';
import { buildCsv, downloadCsv } from '@/lib/csvExport';
import { csvCellText, resolveCsvIdLabels } from '@/lib/csvCellText';
import { errorMessage } from '@/lib/jmapErrors';
import { expandListProperties } from '@/lib/syntheticColumns';
import type { Column, Field, Schema } from '@/types/schema';
import type { ListItem } from './listQuery';

interface ExportCsvButtonProps {
  schema: Schema;
  objectName: string;
  fileBase: string;
  columns: Column[];
  fields: Record<string, Field>;
  /** Rows already held in the browser (client mode); otherwise every matching row is fetched. */
  localRows: ListItem[] | null;
  filter: Record<string, unknown> | undefined;
  sort: Record<string, unknown>[] | undefined;
}

/**
 * CSV export of every row matching the current filters (not just the loaded
 * page), with the visible columns formatted like the table.
 */
export function ExportCsvButton({
  schema,
  objectName,
  fileBase,
  columns,
  fields,
  localRows,
  filter,
  sort,
}: ExportCsvButtonProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);

  const run = async () => {
    setExporting(true);
    try {
      const rows: ListItem[] =
        localRows ??
        (await queryClient.fetchQuery({
          ...fetchAllRowsQuery(objectName, { filter, sort, properties: expandListProperties(columns, objectName) }),
          staleTime: 0,
        }));
      const ctx = {
        schema,
        objectName,
        fields,
        labels: { yes: t('list.csvYes', 'Yes'), no: t('list.csvNo', 'No'), unlimited: t('list.unlimitedQuota', '∞') },
      };
      const idLabels = await resolveCsvIdLabels(rows, columns, ctx);
      const csv = buildCsv(
        columns.map((column) => column.label),
        rows.map((row) => columns.map((column) => csvCellText(column.name, row, ctx, idLabels))),
      );
      downloadCsv(`${fileBase}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast({
        title: t('list.exportSuccess', 'Exported {{count}} rows to CSV', { count: rows.length }),
        variant: 'success',
      });
    } catch (err) {
      toast({ title: errorMessage(err), variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={() => void run()} disabled={exporting || columns.length === 0}>
      {exporting ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
      {t('list.exportCsv', 'Export CSV')}
    </Button>
  );
}
