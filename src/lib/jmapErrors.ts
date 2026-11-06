/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { JmapSetError, JmapSetResponse, ValidationError } from '@/types/jmap';
import { ApiError, JmapMethodError, JmapProtocolError, isAbortError } from '@/services/errors';
import i18n from '@/i18n';

const MAX_REPORTED_ERRORS = 3;

export function validationErrorMessage(ve: ValidationError): string {
  switch (ve.type) {
    case 'Required':
      return i18n.t('form.required', 'This field is required.');
    case 'MaxLength':
      return i18n.t('form.maxLengthIs', 'Maximum length is {{max}}.', { max: ve.required });
    case 'MinLength':
      return i18n.t('form.minLengthIs', 'Minimum length is {{min}}.', { min: ve.required });
    case 'MaxValue':
      return i18n.t('form.maxValueIs', 'Maximum value is {{max}}.', { max: ve.required });
    case 'MinValue':
      return i18n.t('form.minValueIs', 'Minimum value is {{min}}.', { min: ve.required });
    default:
      if (ve.value && ve.value.length > 0) return ve.value;
      return i18n.t('form.invalidValue', 'Invalid value.');
  }
}

export function friendlySetError(err: JmapSetError): string {
  if (err.description) return err.description;
  switch (err.type) {
    case 'forbidden':
      return i18n.t('jmapErrors.forbidden', 'You do not have permission to perform this action.');
    case 'notFound':
      return i18n.t('jmapErrors.notFound', 'The item was not found. It may have been already deleted.');
    case 'objectIsLinked':
      return i18n.t('jmapErrors.objectIsLinked', 'This item is referenced by other items and cannot be deleted.');
    case 'invalidForeignKey':
      return i18n.t('jmapErrors.invalidForeignKey', 'This item references another item that does not exist.');
    case 'primaryKeyViolation':
      return i18n.t('jmapErrors.primaryKeyViolation', 'An item with the same key already exists.');
    case 'alreadyExists':
      return i18n.t('jmapErrors.alreadyExists', 'An item with the same identifier already exists.');
    case 'overQuota':
      return i18n.t('jmapErrors.overQuota', 'The operation exceeds your storage quota.');
    case 'tooLarge':
      return i18n.t('jmapErrors.tooLarge', 'The item is too large.');
    case 'rateLimit':
      return i18n.t('jmapErrors.rateLimit', 'Too many requests. Please try again later.');
    case 'singleton':
      return i18n.t('jmapErrors.singleton', 'This item is a singleton and cannot be deleted.');
    case 'mailboxHasChild':
      return i18n.t('jmapErrors.mailboxHasChild', 'This mailbox has child mailboxes. Delete them first.');
    case 'mailboxHasEmail':
      return i18n.t('jmapErrors.mailboxHasEmail', 'This mailbox contains messages. Remove them first.');
    case 'calendarHasEvent':
      return i18n.t('jmapErrors.calendarHasEvent', 'This calendar contains events. Remove them first.');
    case 'addressBookHasContents':
      return i18n.t('jmapErrors.addressBookHasContents', 'This address book has contacts. Remove them first.');
    case 'nodeHasChildren':
      return i18n.t('jmapErrors.nodeHasChildren', 'This item has children. Delete them first.');
    case 'validationFailed':
      return i18n.t('jmapErrors.validationFailed', 'The data did not pass validation.');
    default:
      return i18n.t('jmapErrors.unexpected', 'Unexpected error ({{type}}).', { type: err.type });
  }
}

export function friendlyMethodError(err: JmapMethodError): string {
  if (err.description) return err.description;
  switch (err.type) {
    case 'forbidden':
      return i18n.t('jmapErrors.forbidden', 'You do not have permission to perform this action.');
    case 'serverUnavailable':
      return i18n.t('jmapErrors.serverUnavailable', 'The server is temporarily unavailable. Please try again later.');
    case 'serverFail':
    case 'serverPartialFail':
      return i18n.t('jmapErrors.serverFail', 'The server encountered an error while processing the request.');
    case 'unknownMethod':
      return i18n.t('jmapErrors.unknownMethod', 'The server does not support this operation ({{method}}).', {
        method: err.methodName,
      });
    case 'invalidArguments':
      return i18n.t('jmapErrors.invalidArguments', 'The server rejected the request arguments.');
    case 'accountNotFound':
    case 'accountNotSupportedByMethod':
      return i18n.t('jmapErrors.accountNotFound', 'The selected account is not available for this operation.');
    case 'accountReadOnly':
      return i18n.t('jmapErrors.accountReadOnly', 'The selected account is read-only.');
    case 'anchorNotFound':
      return i18n.t('jmapErrors.anchorNotFound', 'The list changed while paging. Please reload it.');
    case 'unsupportedFilter':
      return i18n.t('jmapErrors.unsupportedFilter', 'The server does not support this filter.');
    case 'unsupportedSort':
      return i18n.t('jmapErrors.unsupportedSort', 'The server does not support sorting by this column.');
    case 'requestTooLarge':
      return i18n.t('jmapErrors.requestTooLarge', 'The request is too large. Try selecting fewer items.');
    case 'stateMismatch':
      return i18n.t('jmapErrors.stateMismatch', 'The data changed on the server. Please reload and try again.');
    default:
      return i18n.t('jmapErrors.unexpected', 'Unexpected error ({{type}}).', { type: err.type });
  }
}

export function errorMessage(err: unknown, fallback?: string): string {
  const fallbackMessage = fallback ?? i18n.t('errors.unexpectedError', 'An unexpected error occurred.');
  if (err instanceof JmapMethodError) return friendlyMethodError(err);
  if (err instanceof ApiError) {
    if (err.detail) return err.detail;
    if (err.status === 401) return i18n.t('errors.sessionExpired', 'Your session has expired. Please sign in again.');
    if (err.status === 403) {
      return i18n.t('jmapErrors.forbidden', 'You do not have permission to perform this action.');
    }
    if (err.status === 404) return i18n.t('errors.notFound', 'The requested resource was not found.');
    return err.message;
  }
  if (err instanceof JmapProtocolError) return err.message;
  if (isAbortError(err)) return i18n.t('errors.requestAborted', 'The request was cancelled.');
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return fallbackMessage;
}

export interface SetOutcome {
  succeeded: string[];
  failed: Record<string, JmapSetError>;
}

export function updatedOutcome(resp: JmapSetResponse): SetOutcome {
  return { succeeded: Object.keys(resp.updated ?? {}), failed: { ...(resp.notUpdated ?? {}) } };
}

export function destroyedOutcome(resp: JmapSetResponse): SetOutcome {
  return { succeeded: [...(resp.destroyed ?? [])], failed: { ...(resp.notDestroyed ?? {}) } };
}

export type BulkActionType = 'delete' | 'update';

export interface BulkSummary {
  title: string;
  description?: string;
  variant: 'success' | 'destructive';
}

export function bulkResultSummary(
  successCount: number,
  errors: Record<string, JmapSetError> | null,
  actionType: BulkActionType,
): BulkSummary | null {
  const t = i18n.t.bind(i18n);
  const errorEntries = errors ? Object.entries(errors) : [];
  const totalErrors = errorEntries.length;

  if (totalErrors === 0) {
    if (successCount === 0) return null;
    return {
      title:
        actionType === 'delete'
          ? successCount === 1
            ? t('list.bulkSuccessDelete_one', '{{count}} item deleted successfully.', { count: successCount })
            : t('list.bulkSuccessDelete_other', '{{count}} items deleted successfully.', { count: successCount })
          : successCount === 1
            ? t('list.bulkSuccessUpdate_one', '{{count}} item updated successfully.', { count: successCount })
            : t('list.bulkSuccessUpdate_other', '{{count}} items updated successfully.', { count: successCount }),
      variant: 'success',
    };
  }

  const msgCounts = new Map<string, number>();
  for (const [, e] of errorEntries) {
    const msg = friendlySetError(e);
    msgCounts.set(msg, (msgCounts.get(msg) ?? 0) + 1);
  }
  const lines: string[] = [];
  let accounted = 0;
  for (const [msg, count] of msgCounts) {
    if (lines.length >= MAX_REPORTED_ERRORS) break;
    lines.push(count > 1 ? t('list.bulkErrorGrouped', '{{count}} items: {{message}}', { count, message: msg }) : msg);
    accounted += count;
  }
  if (accounted < totalErrors) {
    lines.push(t('list.bulkErrorMore', '…and {{count}} more.', { count: totalErrors - accounted }));
  }
  const description = lines.join('\n');

  if (successCount === 0) {
    return {
      title:
        actionType === 'delete'
          ? totalErrors === 1
            ? t('list.bulkFailDelete_one', 'Failed to delete {{count}} item.', { count: totalErrors })
            : t('list.bulkFailDelete_other', 'Failed to delete {{count}} items.', { count: totalErrors })
          : totalErrors === 1
            ? t('list.bulkFailUpdate_one', 'Failed to update {{count}} item.', { count: totalErrors })
            : t('list.bulkFailUpdate_other', 'Failed to update {{count}} items.', { count: totalErrors }),
      description,
      variant: 'destructive',
    };
  }

  return {
    title:
      actionType === 'delete'
        ? t('list.bulkMixedDelete', '{{success}} deleted, {{failed}} failed.', {
            success: successCount,
            failed: totalErrors,
          })
        : t('list.bulkMixedUpdate', '{{success}} updated, {{failed}} failed.', {
            success: successCount,
            failed: totalErrors,
          }),
    description,
    variant: 'destructive',
  };
}
