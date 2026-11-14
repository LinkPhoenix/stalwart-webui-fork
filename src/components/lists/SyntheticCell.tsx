import { useTranslation } from 'react-i18next';

import { SizeDisplay } from '@/components/common/SizeDisplay';
import { Badge } from '@/components/ui/badge';
import { formatNumber, formatSize } from '@/lib/format';
import { isReportSummaryColumn } from '@/lib/reportSummaries';
import {
  COUNT_COLUMN_SOURCES,
  QUOTA_USAGE_COLUMN,
  computeQuotaUsage,
  getCountColumnValue,
} from '@/lib/syntheticColumns';
import type { Schema } from '@/types/schema';
import { ReportSummaryCell } from './ReportSummaryCell';

const DASH = <span className="text-muted-foreground">-</span>;

function QuotaUsageCell({ item }: { item: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { used, limit } = computeQuotaUsage(item);
  const limitLabel = limit ? formatSize(limit) : t('list.unlimitedQuota', '∞');

  const text =
    used >= 0 ? (
      `${formatSize(used)} / ${limitLabel}`
    ) : (
      <span className="inline-flex items-center gap-1.5">
        <SizeDisplay bytes={used} />
        <span className="text-muted-foreground">/</span>
        <span>{limitLabel}</span>
      </span>
    );

  // A bar only means something against a finite quota with a trustworthy
  // (non-negative) usage counter.
  if (used < 0 || limit <= 0) return <>{text}</>;

  const percent = Math.min(100, (used / limit) * 100);
  const barColor = percent >= 90 ? 'bg-destructive' : percent >= 70 ? 'bg-warning' : 'bg-success';

  return (
    <div className="flex min-w-[8rem] flex-col gap-1">
      <span>{text}</span>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('list.quotaUsagePercent', 'Quota used')}
      >
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * The x:Account list merges its User and Group variants' fields, and Group's
 * `roles` (x:Roles) overrides User's (x:UserRoles) in that merge. The Users
 * list resolves the label against x:UserRoles directly instead.
 */
function UserRoleCell({ value, schema }: { value: unknown; schema: Schema }) {
  const type =
    value && typeof value === 'object' && typeof (value as Record<string, unknown>)['@type'] === 'string'
      ? ((value as Record<string, unknown>)['@type'] as string)
      : undefined;
  if (!type) return DASH;
  const variantSchema = schema.schemas['x:UserRoles'];
  if (variantSchema?.type === 'multiple') {
    const variant = variantSchema.variants.find((v) => v.name === type);
    if (variant) return <Badge variant="secondary">{variant.label}</Badge>;
  }
  return <>{type}</>;
}

interface SyntheticCellProps {
  column: string;
  objectName: string;
  item: Record<string, unknown>;
  schema: Schema;
}

/**
 * SCHEMA-DEVIATION: account-quota-usage-column, account-alias-count-column,
 * role-permission-count-columns, report-summary-columns
 *
 * Renders list columns the schema cannot describe (see hasSyntheticCell).
 */
export function SyntheticCell({ column, objectName, item, schema }: SyntheticCellProps) {
  if (column === QUOTA_USAGE_COLUMN) return <QuotaUsageCell item={item} />;
  if (column in COUNT_COLUMN_SOURCES) {
    return <span className="tabular-nums">{formatNumber(getCountColumnValue(column, item))}</span>;
  }
  if (isReportSummaryColumn(column)) return <ReportSummaryCell colName={column} item={item} />;
  if (column === 'roles' && objectName === 'x:Account') return <UserRoleCell value={item.roles} schema={schema} />;
  return null;
}
