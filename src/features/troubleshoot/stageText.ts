/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { TFunction } from 'i18next';
import { phaseKey } from './stages';
import type { DeliveryStage } from './types';

const PROTOCOL_LABELS: Record<string, string> = {
  ehlo: 'EHLO',
  startTls: 'STARTTLS',
  mailFrom: 'MAIL FROM',
  rcptTo: 'RCPT TO',
  quit: 'QUIT',
};

export function phaseLabel(t: TFunction, stage: DeliveryStage): string {
  if (stage.type === 'deliveryAttemptStart') {
    return t('deliveryTrace.attemptLabel', 'Delivery Attempt: {{hostname}}', { hostname: stage.hostname });
  }
  const phase = phaseKey(stage);
  const protocol = PROTOCOL_LABELS[phase];
  if (protocol) return protocol;
  switch (phase) {
    case 'mxLookup':
      return t('deliveryTrace.phase.mxLookup', 'MX Lookup');
    case 'mtaStsFetch':
      return t('deliveryTrace.phase.mtaStsFetch', 'MTA-STS Policy Fetch');
    case 'tlsRptLookup':
      return t('deliveryTrace.phase.tlsRptLookup', 'TLS-RPT Lookup');
    case 'mtaStsVerify':
      return t('deliveryTrace.phase.mtaStsVerify', 'MTA-STS Verify');
    case 'tlsaLookup':
      return t('deliveryTrace.phase.tlsaLookup', 'TLSA / DANE Lookup');
    case 'ipLookup':
      return t('deliveryTrace.phase.ipLookup', 'IP Lookup');
    case 'connection':
      return t('deliveryTrace.phase.connection', 'TCP Connection');
    case 'readGreeting':
      return t('deliveryTrace.phase.readGreeting', 'Read Greeting');
    case 'daneVerify':
      return t('deliveryTrace.phase.daneVerify', 'DANE Verify');
    default:
      return phase;
  }
}

const IP_PREVIEW = 3;

export function stageBody(t: TFunction, stage: DeliveryStage): string | null {
  switch (stage.type) {
    case 'mxLookupSuccess':
      return t('deliveryTrace.body.mxLookupSuccess', 'Resolved {{count}} MX records', {
        count: stage.mxs.reduce((n, mx) => n + mx.exchanges.length, 0),
      });
    case 'mxLookupStart':
      return t('deliveryTrace.body.mxLookupStart', 'Looking up MX for {{domain}}', { domain: stage.domain });
    case 'mtaStsFetchSuccess':
      return t('deliveryTrace.body.mtaStsFetchSuccess', 'Policy fetched successfully');
    case 'mtaStsNotFound':
      return t('deliveryTrace.body.mtaStsNotFound', 'No MTA-STS policy published');
    case 'tlsRptLookupSuccess':
      return t('deliveryTrace.body.tlsRptLookupSuccess', 'Found {{count}} reporting URIs', { count: stage.rua.length });
    case 'tlsRptNotFound':
      return t('deliveryTrace.body.tlsRptNotFound', 'No TLS-RPT record published');
    case 'ipLookupSuccess': {
      const ips = stage.remoteIps;
      if (ips.length <= IP_PREVIEW) return ips.join(', ');
      return t('deliveryTrace.body.ipLookupOverflow', '{{shown}} +{{extra}} more', {
        shown: ips.slice(0, IP_PREVIEW).join(', '),
        extra: ips.length - IP_PREVIEW,
      });
    }
    case 'connectionStart':
      return t('deliveryTrace.body.connectionStart', 'Connecting to {{ip}}', { ip: stage.remoteIp });
    case 'connectionSuccess':
      return t('deliveryTrace.body.connectionSuccess', 'Connected');
    case 'tlsaLookupSuccess':
      return t('deliveryTrace.body.tlsaLookupSuccess', 'TLSA record found');
    case 'tlsaNotFound':
      return stage.reason || t('deliveryTrace.body.tlsaNotFound', 'No TLSA record found');
    case 'readGreetingSuccess':
      return t('deliveryTrace.body.readGreetingSuccess', 'Server greeting received');
    case 'ehloSuccess':
      return t('deliveryTrace.body.ehloSuccess', 'EHLO accepted');
    case 'startTlsSuccess':
      return t('deliveryTrace.body.startTlsSuccess', 'TLS negotiated');
    case 'daneVerifySuccess':
      return t('deliveryTrace.body.daneVerifySuccess', 'DANE verification passed');
    case 'mtaStsVerifySuccess':
      return t('deliveryTrace.body.mtaStsVerifySuccess', 'MTA-STS hostname verified');
    case 'mailFromSuccess':
      return t('deliveryTrace.body.mailFromSuccess', 'Sender accepted');
    case 'rcptToSuccess':
      return t('deliveryTrace.body.rcptToSuccess', 'Recipient accepted');
    case 'quitCompleted':
      return t('deliveryTrace.body.quitCompleted', 'Session closed');
    default:
      return 'reason' in stage && typeof stage.reason === 'string' ? stage.reason : null;
  }
}
