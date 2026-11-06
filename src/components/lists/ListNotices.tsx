import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { jmapKeys } from '@/data/keys';
import type { QueueOpsLink } from '@/lib/queueOpsLinks';
import { jmapQueryAllAndGet } from '@/services/jmap/client';

const WEB_APPLICATION = 'x:Application';
const ACTIVE_URL_PREFIXES = ['/admin', '/account'];

/** The application serving the admin UI is the one mounted on /admin or /account. */
function isActiveWebApplication(item: Record<string, unknown>): boolean {
  const prefixes = item.urlPrefix;
  const values: string[] = [];
  if (Array.isArray(prefixes)) {
    values.push(...prefixes.map(String));
  } else if (typeof prefixes === 'string') {
    values.push(...prefixes.split(',').map((s) => s.trim()));
  } else if (prefixes && typeof prefixes === 'object') {
    // JMAP exposes urlPrefix as a set object such as { "/admin": true, "/account": true }.
    for (const [key, enabled] of Object.entries(prefixes)) {
      if (enabled === true) values.push(key);
    }
  }
  return values.some((prefix) => ACTIVE_URL_PREFIXES.includes(prefix));
}

/** Web Applications list: shows which WebUI is being served, its version and where it came from. */
export function ActiveWebUiCard() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: [...jmapKeys.lists(WEB_APPLICATION), 'active-webui'],
    queryFn: async ({ signal }) => {
      const result = await jmapQueryAllAndGet(
        WEB_APPLICATION,
        {},
        ['id', 'description', 'enabled', 'urlPrefix', 'resourceUrl'],
        { signal },
      );
      return result.list.find(isActiveWebApplication) ?? null;
    },
  });
  if (!data) return null;
  const resourceUrl = typeof data.resourceUrl === 'string' ? data.resourceUrl : '';

  return (
    <section className="tile space-y-2 px-5 py-4">
      <h2 className="section-title">{t('webApplications.activeWebUI', 'Active WebUI')}</h2>
      <p className="text-sm text-muted-foreground">{String(data.description ?? '-')}</p>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t('webApplications.version', 'Version')}:</span>
        <Badge variant="secondary">{__APP_VERSION__}</Badge>
      </div>
      {resourceUrl && (
        <div className="flex items-start gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">{t('webApplications.resourceUrl', 'Source')}:</span>
          <a href={resourceUrl} target="_blank" rel="noreferrer" className="break-all text-brand-text hover:underline">
            {resourceUrl}
          </a>
        </div>
      )}
    </section>
  );
}

/** Queued messages list: backlog notice with shortcuts to Delivery Trace and Log Entries. */
export function QueueBacklogNotice({ total, links }: { total: number; links: QueueOpsLink[] }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="rounded-xl bg-warning-soft px-4 py-3 text-sm">
      <p className="font-semibold text-warning">
        {t('list.queueBacklogTitle', '{{count}} messages waiting in the queue', { count: total })}
      </p>
      <p className="mt-1 text-muted-foreground">
        {t('list.queueBacklogBody', 'Use Delivery Trace or Log Entries to investigate stuck or delayed mail.')}
      </p>
      {links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {links.map((link) => (
            <Link key={link.viewName} to={link.href} className="font-medium text-brand-text underline">
              {t(link.labelKey[0], link.labelKey[1])}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
