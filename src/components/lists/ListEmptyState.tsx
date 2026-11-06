import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Inbox, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { QueueOpsLink } from '@/lib/queueOpsLinks';

interface ListEmptyStateProps {
  /** True when filters are applied: distinguishes "no match" from a truly empty list. */
  filtersActive: boolean;
  onResetFilters: () => void;
  /** Create target, when the user may create objects of this list. */
  createHref: string | null;
  createLabel: string;
  /** Delivery-queue guidance (queued messages list only). */
  queueLinks: QueueOpsLink[] | null;
}

/** Empty list state: icon plus the most useful next step (reset filters, create, ops links). */
export function ListEmptyState({
  filtersActive,
  onResetFilters,
  createHref,
  createLabel,
  queueLinks,
}: ListEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <Inbox className="h-10 w-10 text-muted-foreground/50" aria-hidden />
      {filtersActive ? (
        <>
          <p>{t('list.noFilterResults', 'No results match these filters')}</p>
          <p className="max-w-sm text-xs">
            {t('list.noFilterResultsHint', 'Text filters require an exact value, not a partial search.')}
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={onResetFilters}>
            <RotateCcw aria-hidden />
            {t('list.resetFilters', 'Reset')}
          </Button>
        </>
      ) : queueLinks ? (
        <>
          <p>{t('list.queueEmptyTitle', 'The delivery queue is empty')}</p>
          <p className="max-w-sm text-xs">
            {t(
              'list.queueEmptyBody',
              'No messages are waiting. If mail is delayed, check Delivery Trace or Log Entries.',
            )}
          </p>
          {queueLinks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {queueLinks.map((link) => (
                <Button key={link.viewName} asChild size="sm" variant="secondary">
                  <Link to={link.href}>{t(link.labelKey[0], link.labelKey[1])}</Link>
                </Button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p>{t('list.noResults', 'No results found')}</p>
          {createHref && (
            <Button asChild size="sm">
              <Link to={createHref}>
                <Plus aria-hidden />
                {createLabel}
              </Link>
            </Button>
          )}
        </>
      )}
    </div>
  );
}
