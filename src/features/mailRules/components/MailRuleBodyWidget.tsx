/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { FieldError, FieldRow } from '@/components/forms/FieldRow';
import { fieldIds, useFieldScope, useFormContext } from '@/components/forms/formContext';
import { missingNestedFields } from '@/components/forms/formLogic';
import { usePermissionCheckers } from '@/hooks/usePermissions';
import { embeddedEntries, isRecord, resolveEmbedded } from '@/lib/embeddedSchema';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { ValueProps } from '@/extensions/types';
import type { Field, FieldTypeObject, FieldTypeObjectList } from '@/types/schema';
import { useRuleAccountId } from '../account';
import { listEntries } from '../builder';
import { mailboxNameResolver } from '../mailboxes';
import {
  hasRejectAction,
  hasScheduleCondition,
  isRejectAllowed,
  MAIL_RULE_ACTION_OBJECT,
  MAIL_RULE_BODY_OBJECT,
  MAIL_RULE_CONDITION_OBJECT,
  parseCustomBody,
  REJECT_ACTION,
  ruleIssues,
  type RuleIssue,
} from '../model';
import { useMailboxOptions } from '../queries';
import { ruleIssueMessage, ruleSentence, summarizeCustomRule } from '../summary';
import { RuleItemList } from './RuleItemList';

const LIST_FIELDS = new Set(['conditions', 'exceptions', 'actions']);
const STOP_PROCESSING = 'stopProcessing';
const TOGGLE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

function listBounds(field: Field | undefined): { minItems?: number; maxItems?: number } {
  const type = field?.type as FieldTypeObjectList | undefined;
  return type?.type === 'objectList' ? { minItems: type.minItems, maxItems: type.maxItems } : {};
}

function MatchModeToggle({
  matchAll,
  onChange,
  readOnly,
}: {
  matchAll: boolean;
  onChange: (matchAll: boolean) => void;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const options = [
    { value: true, label: t('mailRules.builder.all', 'all') },
    { value: false, label: t('mailRules.builder.any', 'any') },
  ];
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (readOnly || !TOGGLE_KEYS.has(event.key)) return;
    event.preventDefault();
    onChange(!matchAll);
    event.currentTarget.querySelector<HTMLButtonElement>('[aria-checked="false"]')?.focus();
  };
  return (
    <span
      role="radiogroup"
      aria-label={t('mailRules.builder.matchMode', 'Conditions that must match')}
      className="inline-flex rounded-lg bg-muted p-0.5 align-middle"
      onKeyDown={onKeyDown}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={matchAll === option.value}
          tabIndex={matchAll === option.value ? 0 : -1}
          disabled={readOnly}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-2.5 py-0.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            matchAll === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}

function Step({ heading, title, children }: { heading: string; title?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 py-3">
      <h3 className={title ? 'sr-only' : 'text-[13.5px] font-semibold'}>{heading}</h3>
      {title && <div className="text-[13.5px] font-semibold">{title}</div>}
      {children}
    </section>
  );
}

function IssueList({ issues }: { issues: readonly RuleIssue[] }) {
  const { t } = useTranslation();
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1.5 py-3">
      {issues.map((issue) => (
        <li key={issue} className="flex items-start gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {ruleIssueMessage(t, issue)}
        </li>
      ))}
    </ul>
  );
}

type BuilderProps = Pick<WidgetProps<FieldTypeObject>, 'value' | 'onChange' | 'readOnly' | 'error'>;

function CustomRuleBuilder({ value, onChange, readOnly, error }: BuilderProps) {
  const { t } = useTranslation();
  const { schema, idPrefix } = useFormContext();
  const scope = useFieldScope();
  const checkers = usePermissionCheckers();
  const exceptionsButton = useRef<HTMLButtonElement>(null);
  const body = isRecord(value) ? value : {};
  const custom = parseCustomBody(body);
  const resolved = resolveEmbedded(schema, MAIL_RULE_BODY_OBJECT, body);
  const entries = resolved ? embeddedEntries(resolved) : [];
  const fieldOf = (name: string) => entries.find((entry) => entry.formField.name === name);
  const invalid = !!error;
  const missing = invalid ? missingNestedFields(schema, MAIL_RULE_BODY_OBJECT, body) : [];
  const [exceptionsExpanded, setExceptionsExpanded] = useState<boolean | null>(null);
  const set = (name: string, next: unknown) => onChange({ ...body, [name]: next });
  const issues = ruleIssues({ isEnabled: true, body }, checkers);
  const hasReject = hasRejectAction(custom);
  const rejectBlocked =
    custom.actions.length > 1
      ? t('mailRules.builder.rejectNotAlone', 'Reject must be the only action.')
      : isRejectAllowed(custom)
        ? undefined
        : t(
            'mailRules.builder.rejectNeedsAuthentication',
            'Reject needs all conditions to match, including an authenticated sender.',
          );
  const disabledActions = rejectBlocked ? new Map([[REJECT_ACTION, rejectBlocked]]) : undefined;
  const conditionLabel = (n: number) => t('mailRules.builder.conditionN', 'Condition {{n}}', { n });
  const exceptionLabel = (n: number) => t('mailRules.builder.exceptionN', 'Exception {{n}}', { n });
  const actionLabel = (n: number) => t('mailRules.builder.actionN', 'Action {{n}}', { n });
  const showExceptions = missing.includes('exceptions') || (exceptionsExpanded ?? custom.exceptions.length > 0);
  const exceptionsId = `${fieldIds(idPrefix, [...scope.path, 'exceptions']).inputId}-list`;
  const actionsErrorId = fieldIds(idPrefix, [...scope.path, 'actions']).errorId;
  const ruleError = missing.length === 0 ? error : undefined;
  const changeExceptions = (next: unknown) => {
    if (custom.exceptions.length > 0 && listEntries(next).length === 0) exceptionsButton.current?.focus();
    set('exceptions', next);
  };
  const trailing = entries.filter(
    ({ formField }) =>
      !LIST_FIELDS.has(formField.name) &&
      formField.name !== 'matchAll' &&
      (formField.name !== 'timeZone' || hasScheduleCondition(custom)),
  );

  return (
    <div className="divide-y divide-border" data-testid="mail-rule-builder">
      {ruleError && (
        <div className="pb-3">
          <FieldError id={fieldIds(idPrefix, scope.path).errorId} error={ruleError} />
        </div>
      )}
      <Step
        heading={
          custom.conditions.length >= 2
            ? t('mailRules.builder.conditions', 'Conditions')
            : custom.conditions.length === 1
              ? t('mailRules.builder.ifOne', 'If this condition matches')
              : t('mailRules.builder.ifNone', 'For every message')
        }
        title={
          custom.conditions.length >= 2 && (
            <span className="flex flex-wrap items-center gap-1.5">
              {t('mailRules.builder.ifPrefix', 'If')}
              <MatchModeToggle
                matchAll={custom.matchAll}
                onChange={(matchAll) => set('matchAll', matchAll)}
                readOnly={readOnly}
              />
              {t('mailRules.builder.ifSuffix', 'of these conditions match')}
            </span>
          )
        }
      >
        {custom.conditions.length === 0 && (
          <p className="text-[12.5px] text-muted-foreground">
            {t('mailRules.builder.noConditions', 'Without conditions the rule applies to every message.')}
          </p>
        )}
        <RuleItemList
          name="conditions"
          objectName={MAIL_RULE_CONDITION_OBJECT}
          value={body.conditions}
          onChange={(next) => set('conditions', next)}
          readOnly={readOnly}
          invalid={invalid}
          {...listBounds(fieldOf('conditions')?.field)}
          itemLabel={conditionLabel}
          addLabel={t('mailRules.builder.addCondition', 'Add condition')}
        />
      </Step>

      <section className="py-3">
        <button
          ref={exceptionsButton}
          type="button"
          aria-expanded={showExceptions}
          aria-controls={exceptionsId}
          onClick={() => setExceptionsExpanded(!showExceptions)}
          className="flex items-center gap-1.5 rounded-md text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn('size-4 text-dim transition-transform', showExceptions && 'rotate-90')}
            aria-hidden="true"
          />
          {t('mailRules.builder.except', 'Except if any of these match')}
          {!showExceptions && custom.exceptions.length > 0 && (
            <span className="font-normal text-muted-foreground">({custom.exceptions.length})</span>
          )}
        </button>
        {showExceptions && (
          <div id={exceptionsId} className="mt-2">
            <RuleItemList
              name="exceptions"
              objectName={MAIL_RULE_CONDITION_OBJECT}
              value={body.exceptions}
              onChange={changeExceptions}
              readOnly={readOnly}
              invalid={invalid}
              {...listBounds(fieldOf('exceptions')?.field)}
              itemLabel={exceptionLabel}
              addLabel={t('mailRules.builder.addException', 'Add exception')}
            />
          </div>
        )}
      </section>

      <Step heading={t('mailRules.builder.then', 'Then')}>
        <RuleItemList
          name="actions"
          objectName={MAIL_RULE_ACTION_OBJECT}
          value={body.actions}
          onChange={(next) => set('actions', next)}
          readOnly={readOnly}
          invalid={invalid}
          {...listBounds(fieldOf('actions')?.field)}
          canAddMore={!hasReject}
          itemLabel={actionLabel}
          addLabel={t('mailRules.builder.addAction', 'Add action')}
          disabledVariants={disabledActions}
        />
        {invalid && custom.actions.length === 0 && (
          <FieldError id={actionsErrorId} error={t('mailRules.builder.actionRequired', 'Add at least one action.')} />
        )}
      </Step>

      {trailing.length > 0 && (
        <div className="@container">
          {trailing.map(({ formField, field }) =>
            hasReject && formField.name === STOP_PROCESSING ? (
              <div key={formField.name}>
                <FieldRow field={field} formField={formField} value={true} onChange={() => {}} readOnly />
                <p className="pb-3 text-[12.5px] text-muted-foreground">
                  {t('mailRules.builder.rejectStops', 'A rule that rejects mail always stops processing more rules.')}
                </p>
              </div>
            ) : (
              <FieldRow
                key={formField.name}
                field={field}
                formField={formField}
                value={body[formField.name]}
                onChange={(next) => set(formField.name, next)}
              />
            ),
          )}
        </div>
      )}

      <IssueList issues={issues} />
    </div>
  );
}

export function MailRuleBodyEditor({ value, onChange, readOnly, error }: WidgetProps<FieldTypeObject>) {
  return <CustomRuleBuilder value={value} onChange={onChange} readOnly={readOnly} error={error} />;
}

export function MailRuleBodyView({ schema, value, variant }: ValueProps) {
  const { t } = useTranslation();
  const accountId = useRuleAccountId();
  const mailboxes = useMailboxOptions(accountId);
  const ctx = {
    t,
    schema,
    mailboxName: mailboxes.status === 'ready' ? mailboxNameResolver(mailboxes.options) : undefined,
  };
  const text = ruleSentence(ctx, summarizeCustomRule(ctx, isRecord(value) ? value : {}));
  return <span className={cn(variant === 'compact' ? 'truncate' : 'whitespace-normal break-words')}>{text}</span>;
}
