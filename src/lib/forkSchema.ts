import { withClientLogFilters } from '@/lib/logFilters';
import { withAccountListColumns } from '@/lib/accountColumns';
import { withMailingListColumns } from '@/lib/mailingListColumns';
import { withRoleListColumns } from '@/lib/roleColumns';
import { withDomainColumns } from '@/lib/domainColumns';
import { withReportListColumns } from '@/lib/reportColumns';
import {
  withDirectoryColumns,
  withDnsServerColumns,
  withNetworkListenerColumns,
  withWebhookColumns,
} from '@/lib/operationsListColumns';
import type { Schema } from '@/types/schema';

/**
 * Applies every fork schema deviation that patches the fetched schema.
 * Each helper is documented (and tagged) in SCHEMA_DEVIATIONS.md.
 */
export function withForkSchemaDeviations(schema: Schema): Schema {
  return withReportListColumns(
    withDomainColumns(
      withRoleListColumns(
        withMailingListColumns(
          withAccountListColumns(
            withNetworkListenerColumns(
              withDnsServerColumns(withDirectoryColumns(withWebhookColumns(withClientLogFilters(schema)))),
            ),
          ),
        ),
      ),
    ),
  );
}
