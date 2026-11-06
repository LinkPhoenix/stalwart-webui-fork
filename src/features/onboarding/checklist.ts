/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { jmapQuery, jmapQueryAllAndGet } from '@/services/jmap/client';

export const ONBOARDING_VIEW_NAME = 'CustomComponent/Onboarding';

export type CheckStatus = 'loading' | 'done' | 'pending' | 'unknown';

export interface ChecklistItemDef {
  id: string;
  permissionPrefix: string;
  titleKey: [string, string];
  descriptionKey: [string, string];
  actionLabelKey: [string, string];
  actionHref: string;
  check: () => Promise<boolean>;
  /**
   * When false, the item is shown for awareness but does not block hiding
   * Getting Started (e.g. inbound DMARC reports may arrive later).
   * Defaults to true.
   */
  requiredForCompletion?: boolean;
}

export interface OnboardingFurtherLink {
  id: string;
  titleKey: [string, string];
  descriptionKey: [string, string];
  href: string;
  external?: boolean;
}

async function hasEnabledDomain(): Promise<boolean> {
  const { list } = await jmapQueryAllAndGet('x:Domain', {}, ['isEnabled']);
  return list.some((d) => d.isEnabled === true);
}

async function hasDkimSignature(): Promise<boolean> {
  const { ids } = await jmapQueryAllAndGet('x:DkimSignature', {}, []);
  return ids.length > 0;
}

async function hasValidCertificate(): Promise<boolean> {
  const { list } = await jmapQueryAllAndGet('x:Certificate', {}, ['notValidAfter']);
  const now = Date.now();
  return list.some((c) => {
    const notValidAfter = c.notValidAfter;
    if (typeof notValidAfter !== 'string') return false;
    const expiry = Date.parse(notValidAfter);
    return Number.isFinite(expiry) && expiry > now;
  });
}

async function hasAdminAccount(): Promise<boolean> {
  const { list } = await jmapQueryAllAndGet('x:Account', { filter: { '@type': 'User' } }, ['roles']);
  return list.some((a) => {
    const roles = a.roles as Record<string, unknown> | undefined;
    return roles?.['@type'] === 'Admin';
  });
}

async function hasAnyObject(objectType: string): Promise<boolean> {
  const result = await jmapQuery(objectType, { limit: 1, position: 0, calculateTotal: true });
  if (typeof result.total === 'number') return result.total > 0;
  return (result.ids?.length ?? 0) > 0;
}

async function hasDmarcExternalReport(): Promise<boolean> {
  return hasAnyObject('x:DmarcExternalReport');
}

// SCHEMA-DEVIATION: onboarding-checklist-nav-entry (see SCHEMA_DEVIATIONS.md)
// Each item checks a real, already-editable property (domain enabled state,
// DKIM signature presence, certificate expiry, an account with the Admin
// role, inbound DMARC reports) — nothing here is fabricated data, only the
// checklist framing itself is new.
export const ONBOARDING_ITEMS: ChecklistItemDef[] = [
  {
    id: 'domain',
    permissionPrefix: 'sysDomain',
    titleKey: ['onboarding.domain.title', 'Configure a domain'],
    descriptionKey: [
      'onboarding.domain.description',
      'At least one domain must be added and enabled before this server can handle mail for it.',
    ],
    actionLabelKey: ['onboarding.domain.action', 'Go to Domains'],
    actionHref: '/Management/x:Domain',
    check: hasEnabledDomain,
  },
  {
    id: 'dkim',
    permissionPrefix: 'sysDkimSignature',
    titleKey: ['onboarding.dkim.title', 'Set up DKIM signing'],
    descriptionKey: [
      'onboarding.dkim.description',
      'A DKIM signature lets receiving servers verify mail actually came from your domain.',
    ],
    actionLabelKey: ['onboarding.dkim.action', 'Go to DKIM Signatures'],
    actionHref: '/Management/x:DkimSignature',
    check: hasDkimSignature,
  },
  {
    id: 'certificate',
    permissionPrefix: 'sysCertificate',
    titleKey: ['onboarding.certificate.title', 'Install a valid TLS certificate'],
    descriptionKey: [
      'onboarding.certificate.description',
      'Required for encrypted SMTP/IMAP/HTTPS connections. Checked for at least one certificate that has not expired.',
    ],
    actionLabelKey: ['onboarding.certificate.action', 'Go to TLS Certificates'],
    actionHref: '/Settings/x:Certificate',
    check: hasValidCertificate,
  },
  {
    id: 'admin',
    permissionPrefix: 'sysAccount',
    titleKey: ['onboarding.admin.title', 'Create an administrator account'],
    descriptionKey: [
      'onboarding.admin.description',
      'A named admin account, separate from the break-glass recovery admin, should be used for day-to-day management.',
    ],
    actionLabelKey: ['onboarding.admin.action', 'Go to Accounts'],
    actionHref: '/Management/x:Account/User',
    check: hasAdminAccount,
  },
  {
    id: 'dmarcReports',
    permissionPrefix: 'sysDmarcExternalReport',
    titleKey: ['onboarding.dmarcReports.title', 'Start receiving DMARC reports'],
    descriptionKey: [
      'onboarding.dmarcReports.description',
      'Publish a DMARC DNS record that sends aggregate reports to this server. Optional — reports may take time to arrive.',
    ],
    actionLabelKey: ['onboarding.dmarcReports.action', 'Go to DMARC reports'],
    actionHref: '/Management/x:DmarcExternalReport',
    check: hasDmarcExternalReport,
    requiredForCompletion: false,
  },
];

/** Static doc links shown under “Want to go further?”. */
export const ONBOARDING_DOC_LINKS: OnboardingFurtherLink[] = [
  {
    id: 'spf-docs',
    titleKey: ['onboarding.further.spfTitle', 'Publish SPF'],
    descriptionKey: [
      'onboarding.further.spfDescription',
      'Authorise this server to send mail for your domain (DNS TXT).',
    ],
    href: 'https://stalw.art/docs/auth/spf/',
    external: true,
  },
  {
    id: 'dmarc-docs',
    titleKey: ['onboarding.further.dmarcTitle', 'Publish DMARC'],
    descriptionKey: [
      'onboarding.further.dmarcDescription',
      'Ask receivers to report authentication results back to you.',
    ],
    href: 'https://stalw.art/docs/mta/reports/dmarc/',
    external: true,
  },
];

/**
 * Returns true when every *required* checklist item the user can query is
 * already done (or when they cannot query any required items).
 */
export async function isOnboardingComplete(
  canQuery: (permissionPrefix: string) => boolean,
): Promise<boolean> {
  const checkable = ONBOARDING_ITEMS.filter(
    (item) => item.requiredForCompletion !== false && canQuery(item.permissionPrefix),
  );
  if (checkable.length === 0) return true;

  const results = await Promise.all(
    checkable.map(async (item) => {
      try {
        return await item.check();
      } catch {
        return false;
      }
    }),
  );
  return results.every(Boolean);
}
