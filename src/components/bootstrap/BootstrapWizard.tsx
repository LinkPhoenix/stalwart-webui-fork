/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Rocket } from 'lucide-react';

import { useSchemaStore } from '@/stores/schemaStore';
import { FieldWidget } from '@/components/forms/FieldWidget';
import { FormEditionContext } from '@/components/forms/FormEditionContext';
import { DefaultLogo } from '@/components/common/Logo';
import { toast } from '@/hooks/use-toast';
import { resolveObject, resolveSchema, resolveForm, buildCreateDefaults, deepMerge } from '@/lib/schemaResolver';
import { calculateJmapPatch } from '@/lib/jmapPatch';
import { jmapGet, jmapSet, getAccountId } from '@/services/jmap/client';
import { friendlySetError, validationErrorMessage } from '@/lib/jmapErrors';

import type { Field, Fields, Form, FormField } from '@/types/schema';
import type { JmapSetError, JmapSetResponse } from '@/types/jmap';

const BOOTSTRAP_VIEW = 'x:Bootstrap';

interface RenderableField {
  formField: FormField;
  field: Field;
}

export function BootstrapWizard() {
  const { t } = useTranslation();
  const schema = useSchemaStore((s) => s.schema);

  const resolved = useMemo(() => {
    if (!schema) return null;
    const obj = resolveObject(schema, BOOTSTRAP_VIEW);
    if (!obj) return null;
    const sch = resolveSchema(schema, obj.objectName);
    if (!sch || sch.type !== 'single') return null;
    const form = resolveForm(schema, BOOTSTRAP_VIEW, obj.objectName, sch.schemaName);
    return { obj, sch, fields: sch.fields, form };
  }, [schema]);

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [originalData, setOriginalData] = useState<Record<string, unknown>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successExtras, setSuccessExtras] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const sections = useMemo((): { title?: string; subtitle?: string; fields: RenderableField[] }[] => {
    if (!resolved) return [];
    const { fields, form } = resolved;
    if (!form) return [];
    return form.sections
      .map((section) => {
        const renderableFields: RenderableField[] = [];
        for (const ff of section.fields) {
          const field = fields.properties[ff.name];
          if (!field) continue;
          if (field.update === 'serverSet') continue;
          if (field.enterprise) continue;
          renderableFields.push({ formField: ff, field });
        }
        return { title: section.title, fields: renderableFields };
      })
      .filter((s) => s.fields.length > 0);
  }, [resolved]);

  const fetchProperties = useMemo((): string[] => {
    if (!resolved) return ['id'];
    const set = new Set<string>(['id']);
    for (const section of sections) {
      for (const rf of section.fields) set.add(rf.formField.name);
    }
    return Array.from(set);
  }, [resolved, sections]);

  useEffect(() => {
    if (!schema || !resolved) return;
    const { obj, sch } = resolved;

    const ctrl = new AbortController();

    (async () => {
      setLoading(true);
      try {
        const accountId = getAccountId(obj.objectName);
        const responses = await jmapGet(obj.objectName, accountId, ['singleton'], fetchProperties, ctrl.signal);
        if (ctrl.signal.aborted) return;

        const server = (responses[0]?.[1]?.list as Array<Record<string, unknown>> | undefined)?.[0] ?? {};
        const defaults = buildCreateDefaults(schema, obj, sch);
        const seeded = deepMerge(defaults, server);
        setFormData(seeded);
        setOriginalData({});
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setGeneralError(
          err instanceof Error ? err.message : t('bootstrap.failedToLoad', 'Failed to load bootstrap state.'),
        );
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      ctrl.abort();
    };
  }, [schema, resolved, fetchProperties, t]);

  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setFieldErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  }, []);

  const validateSectionRequired = useCallback(
    (sectionFields: RenderableField[], data: Record<string, unknown>): Record<string, string> => {
      const errors: Record<string, string> = {};
      for (const { formField, field } of sectionFields) {
        if (field.update === 'serverSet' || field.update === 'immutable') continue;
        const fieldType = field.type;
        const eligible =
          fieldType.type === 'string' ||
          fieldType.type === 'number' ||
          fieldType.type === 'utcDateTime' ||
          fieldType.type === 'enum' ||
          fieldType.type === 'blobId' ||
          fieldType.type === 'objectId';
        if (!eligible) continue;
        if ('nullable' in fieldType && fieldType.nullable) continue;
        const value = data[formField.name];
        const isEmpty = value === undefined || value === null || (typeof value === 'string' && value === '');
        if (isEmpty) errors[formField.name] = t('form.required', 'This field is required.');
      }
      return errors;
    },
    [t],
  );

  const applySetError = useCallback(
    (error: JmapSetError): number | null => {
      setGeneralError(friendlySetError(error));

      const fieldToPage = new Map<string, number>();
      sections.forEach((section, idx) => {
        for (const rf of section.fields) {
          if (!fieldToPage.has(rf.formField.name)) fieldToPage.set(rf.formField.name, idx);
        }
      });

      const newErrors: Record<string, string> = {};
      let earliest: number | null = null;
      const record = (topLevel: string, msg: string) => {
        if (!fieldToPage.has(topLevel)) return;
        newErrors[topLevel] = msg;
        const idx = fieldToPage.get(topLevel)!;
        if (earliest === null || idx < earliest) earliest = idx;
      };

      if (error.properties) {
        for (const prop of error.properties) {
          const top = prop.split('/')[0];
          record(top, error.description ?? t('form.invalidValue', 'Invalid value.'));
        }
      }
      if (error.validationErrors) {
        for (const ve of error.validationErrors) {
          const top = ve.property?.split('/')[0] ?? '';
          if (!top) continue;
          record(top, validationErrorMessage(ve));
        }
      }

      if (Object.keys(newErrors).length > 0) setFieldErrors(newErrors);
      return earliest;
    },
    [sections, t],
  );

  const canGoBack = currentPage > 0;
  const isLastPage = currentPage === sections.length - 1;

  const handleNext = useCallback(() => {
    const current = sections[currentPage];
    if (!current) return;
    const errs = validateSectionRequired(current.fields, formData);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setGeneralError(t('form.correctErrorsBelow', 'Please correct the errors below.'));
      return;
    }
    setGeneralError(null);
    setFieldErrors({});
    setCurrentPage((p) => Math.min(p + 1, sections.length - 1));
  }, [currentPage, sections, formData, validateSectionRequired, t]);

  const handleBack = useCallback(() => {
    setGeneralError(null);
    setFieldErrors({});
    setCurrentPage((p) => Math.max(p - 1, 0));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!resolved) return;
    const { obj } = resolved;

    let firstInvalid: number | null = null;
    const allErrors: Record<string, string> = {};
    sections.forEach((section, idx) => {
      const errs = validateSectionRequired(section.fields, formData);
      for (const [k, v] of Object.entries(errs)) {
        allErrors[k] = v;
        if (firstInvalid === null) firstInvalid = idx;
      }
    });
    if (firstInvalid !== null) {
      setFieldErrors(allErrors);
      setGeneralError(t('form.correctErrorsBelow', 'Please correct the errors below.'));
      setCurrentPage(firstInvalid);
      return;
    }

    setSaving(true);
    setGeneralError(null);
    setFieldErrors({});

    try {
      const patch = calculateJmapPatch(originalData, formData);

      const accountId = getAccountId(obj.objectName);
      const responses = await jmapSet(obj.objectName, accountId, {
        update: { singleton: patch },
      });
      const setResult = responses[responses.length - 1]?.[1] as unknown as JmapSetResponse;

      if (setResult.updated && 'singleton' in setResult.updated) {
        setSuccessExtras(setResult.updated.singleton ?? {});
      } else if (setResult.notUpdated && setResult.notUpdated.singleton) {
        const earliest = applySetError(setResult.notUpdated.singleton);
        if (earliest !== null) setCurrentPage(earliest);
      } else {
        setGeneralError(t('bootstrap.noConfirm', 'The server did not confirm the update.'));
      }
    } catch (err) {
      setGeneralError(
        err instanceof Error ? err.message : t('bootstrap.failedToComplete', 'Failed to complete setup.'),
      );
    } finally {
      setSaving(false);
    }
  }, [resolved, sections, formData, originalData, validateSectionRequired, applySetError, t]);

  const handleCopy = useCallback(
    async (key: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(key);
        setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
      } catch {
        toast({
          title: t('bootstrap.copyFailed', 'Copy failed'),
          description: t('bootstrap.clipboardBlocked', 'Your browser blocked clipboard access.'),
          variant: 'destructive',
        });
      }
    },
    [t],
  );

  if (!schema || !resolved) {
    return (
      <WizardShell>
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {t('form.loadingSchema', 'Loading schema...')}
        </div>
      </WizardShell>
    );
  }

  if (loading) {
    return (
      <WizardShell>
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {t('bootstrap.loadingSetup', 'Loading setup...')}
        </div>
      </WizardShell>
    );
  }

  if (successExtras !== null) {
    return (
      <WizardShell>
        <SuccessScreen
          extras={successExtras}
          fields={resolved.fields}
          labelsByName={labelsByFieldName(resolved.form)}
          onCopy={handleCopy}
          copied={copied}
        />
      </WizardShell>
    );
  }

  if (sections.length === 0) {
    return (
      <WizardShell>
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {t('bootstrap.emptyForm', 'Setup form is empty. The server did not return any bootstrap fields.')}
        </div>
      </WizardShell>
    );
  }

  const current = sections[currentPage];

  return (
    <WizardShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t('bootstrap.welcome', 'Welcome to Stalwart')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('bootstrap.welcomeSubtitle', "Let's get your server set up.")}
          </p>
        </div>

        <ProgressIndicator total={sections.length} current={currentPage} />

        {generalError && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-destructive whitespace-pre-line">{generalError}</p>
          </div>
        )}

        <Card>
          {current.title && (
            <CardHeader>
              <CardTitle className="text-base">{current.title}</CardTitle>
            </CardHeader>
          )}
          <CardContent className={current.title ? '' : 'pt-6'}>
            <div className="space-y-6">
              <FormEditionContext.Provider value="oss">
                {current.fields.map(({ formField, field }) => (
                  <FieldWidget
                    key={formField.name}
                    field={field}
                    formField={formField}
                    value={formData[formField.name]}
                    onChange={(v) => handleFieldChange(formField.name, v)}
                    readOnly={saving}
                    error={fieldErrors[formField.name]}
                    schema={schema}
                  />
                ))}
              </FormEditionContext.Provider>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="outline" onClick={handleBack} disabled={!canGoBack || saving}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back', 'Back')}
          </Button>
          <div className="text-xs text-muted-foreground">
            {t('bootstrap.stepOf', 'Step {{current}} of {{total}}', {
              current: currentPage + 1,
              total: sections.length,
            })}
          </div>
          {isLastPage ? (
            <Button type="button" onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
              {t('bootstrap.finishSetup', 'Finish setup')}
            </Button>
          ) : (
            <Button type="button" onClick={handleNext} disabled={saving}>
              {t('common.next', 'Next')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </WizardShell>
  );
}

function WizardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-content-background">
      <header className="flex items-center px-6 py-4 border-b bg-background">
        <DefaultLogo />
      </header>
      <ScrollArea role="main" className="min-w-0 flex-1">
        <div className="min-w-0 p-4 sm:p-6">
          <div className="mx-auto w-full min-w-0 max-w-3xl">{children}</div>
        </div>
      </ScrollArea>
    </div>
  );
}

function ProgressIndicator({ total, current }: { total: number; current: number }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-2"
      aria-label={t('bootstrap.stepOf', 'Step {{current}} of {{total}}', { current: current + 1, total })}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full transition-colors ${
            i < current ? 'bg-primary' : i === current ? 'bg-primary' : 'bg-muted-foreground/20'
          }`}
        />
      ))}
    </div>
  );
}

function SuccessScreen({
  extras,
  fields,
  labelsByName,
  onCopy,
  copied,
}: {
  extras: Record<string, unknown>;
  fields: Fields;
  labelsByName: Map<string, string>;
  onCopy: (key: string, value: string) => void;
  copied: string | null;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(extras).filter(([k, v]) => {
    if (k === 'id' || k === 'blobId' || k === '@type') return false;
    return typeof v === 'string' && v.length > 0;
  }) as [string, string][];

  const hasCredentials = entries.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t('bootstrap.complete', 'Setup complete')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {hasCredentials
              ? t(
                  'bootstrap.credentialsCreated',
                  'Your administrator account has been created. Write these down now: the password will not be shown again.',
                )
              : t('bootstrap.configuredSuccessfully', 'Stalwart has been configured successfully.')}
          </p>
        </div>
      </div>

      {hasCredentials && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {entries.map(([key, value]) => {
              const field = fields.properties[key];
              const label = labelsByName.get(key) ?? field?.description?.split('\n')[0] ?? key;
              return (
                <div key={key} className="space-y-1.5">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded bg-muted p-2 text-sm break-all select-all">{value}</code>
                    <Button type="button" variant="outline" size="sm" onClick={() => onCopy(key, value)}>
                      {copied === key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm">
          <span className="font-medium">{t('bootstrap.nextStepLabel', 'Next step:')}</span>{' '}
          {t(
            'bootstrap.nextStepBody',
            'restart Stalwart for the new configuration to take effect. Once restarted, sign in with the credentials above to continue administering your server.',
          )}
        </p>
      </div>
    </div>
  );
}

function labelsByFieldName(form: Form | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!form) return map;
  for (const section of form.sections) {
    for (const ff of section.fields) map.set(ff.name, ff.label);
  }
  return map;
}

export default BootstrapWizard;
