/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Loader2, Rocket } from 'lucide-react';

import { useSchemaStore } from '@/stores/schemaStore';
import { FormProvider } from '@/components/forms/FormProvider';
import { FieldRow } from '@/components/forms/FieldRow';
import { mapSetError, validateRequired, type FieldErrors } from '@/components/forms/formLogic';
import { ProgressIndicator, SuccessScreen, WizardShell } from '@/components/bootstrap/BootstrapScreens';
import { resolveObject, resolveSchema, resolveForm, buildCreateDefaults, deepMerge } from '@/lib/schemaResolver';
import { calculateJmapPatch } from '@/lib/jmapPatch';
import { useJmapObject } from '@/data/objects';
import { useJmapSet } from '@/data/mutations';
import { errorMessage, friendlySetError, validationErrorMessage } from '@/lib/jmapErrors';

import type { Field, Form, FormField } from '@/types/schema';
import type { JmapSetError } from '@/types/jmap';

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
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successExtras, setSuccessExtras] = useState<Record<string, unknown> | null>(null);

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

  const stateQuery = useJmapObject(resolved?.obj.objectName, 'singleton', fetchProperties, { staleTime: 0 });
  const setMutation = useJmapSet(resolved?.obj.objectName);
  const [seeded, setSeeded] = useState(false);
  if (!seeded && schema && resolved && stateQuery.isSuccess) {
    setSeeded(true);
    setFormData(deepMerge(buildCreateDefaults(schema, resolved.obj, resolved.sch), stateQuery.data ?? {}));
    setOriginalData({});
  }
  const loading = !seeded && !stateQuery.isError;
  const loadError = stateQuery.isError
    ? errorMessage(stateQuery.error, t('bootstrap.failedToLoad', 'Failed to load bootstrap state.'))
    : null;

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
    (sectionFields: RenderableField[], data: Record<string, unknown>): FieldErrors => {
      const properties: Record<string, Field> = {};
      for (const { formField, field } of sectionFields) properties[formField.name] = field;
      return validateRequired(data, { properties }, 'edit', t('form.required', 'This field is required.'));
    },
    [t],
  );

  const applySetError = useCallback(
    (error: JmapSetError): number | null => {
      const fieldToPage = new Map<string, number>();
      sections.forEach((section, idx) => {
        for (const rf of section.fields) {
          if (!fieldToPage.has(rf.formField.name)) fieldToPage.set(rf.formField.name, idx);
        }
      });
      const { general, fieldErrors: errors } = mapSetError(error, new Set(fieldToPage.keys()), {
        general: friendlySetError(error),
        invalidValue: t('form.invalidValue', 'Invalid value.'),
        validation: validationErrorMessage,
      });
      setGeneralError(general);
      if (Object.keys(errors).length > 0) setFieldErrors(errors);
      let earliest: number | null = null;
      for (const name of Object.keys(errors)) {
        const idx = fieldToPage.get(name);
        if (idx !== undefined && (earliest === null || idx < earliest)) earliest = idx;
      }
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

      const setResult = await setMutation.mutateAsync({ update: { singleton: patch } });

      if (setResult.updated && 'singleton' in setResult.updated) {
        setSuccessExtras(setResult.updated.singleton ?? {});
      } else if (setResult.notUpdated && setResult.notUpdated.singleton) {
        const earliest = applySetError(setResult.notUpdated.singleton);
        if (earliest !== null) setCurrentPage(earliest);
      } else {
        setGeneralError(t('bootstrap.noConfirm', 'The server did not confirm the update.'));
      }
    } catch (err) {
      setGeneralError(errorMessage(err, t('bootstrap.failedToComplete', 'Failed to complete setup.')));
    } finally {
      setSaving(false);
    }
  }, [resolved, sections, formData, originalData, validateSectionRequired, applySetError, setMutation, t]);

  if (!schema || !resolved) {
    return (
      <WizardShell>
        <div className="flex items-center justify-center p-12 text-muted-foreground" role="status">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand-text" aria-hidden="true" />
          {t('form.loadingSchema', 'Loading schema...')}
        </div>
      </WizardShell>
    );
  }

  if (loading) {
    return (
      <WizardShell>
        <div className="flex items-center justify-center p-12 text-muted-foreground" role="status">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-brand-text" aria-hidden="true" />
          {t('bootstrap.loadingSetup', 'Loading setup...')}
        </div>
      </WizardShell>
    );
  }

  if (loadError) {
    return (
      <WizardShell>
        <div className="mt-3 space-y-4 rounded-xl bg-destructive-soft p-4">
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void stateQuery.refetch()}
            disabled={stateQuery.isFetching}
          >
            {t('common.retry', 'Retry')}
          </Button>
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
        />
      </WizardShell>
    );
  }

  if (sections.length === 0) {
    return (
      <WizardShell>
        <div className="mt-3 rounded-xl bg-destructive-soft p-4 text-sm text-destructive">
          {t('bootstrap.emptyForm', 'Setup form is empty. The server did not return any bootstrap fields.')}
        </div>
      </WizardShell>
    );
  }

  const current = sections[currentPage];

  return (
    <WizardShell>
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-end justify-between gap-4 px-1 pb-2 pt-3">
          <div>
            <h1 className="page-title">{t('bootstrap.welcome', 'Welcome to Stalwart')}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t('bootstrap.welcomeSubtitle', "Let's get your server set up.")}
            </p>
          </div>
          <ProgressIndicator total={sections.length} current={currentPage} />
        </div>

        {generalError && (
          <div className="rounded-xl bg-destructive-soft p-4" role="alert">
            <p className="whitespace-pre-line text-sm text-destructive">{generalError}</p>
          </div>
        )}

        <section className="tile @container px-5 pb-1.5 sm:px-6">
          {current.title && <h2 className="section-title pb-1 pt-5">{current.title}</h2>}
          <fieldset disabled={saving} className={cn('min-w-0 divide-y divide-border', !current.title && 'pt-1')}>
            <FormProvider schema={schema} mode="create" hideEnterprise>
              {current.fields.map(({ formField, field }) => (
                <FieldRow
                  key={formField.name}
                  field={field}
                  formField={formField}
                  value={formData[formField.name]}
                  onChange={(v) => handleFieldChange(formField.name, v)}
                  error={fieldErrors[formField.name]}
                />
              ))}
            </FormProvider>
          </fieldset>
        </section>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleBack} disabled={!canGoBack || saving}>
            <ArrowLeft aria-hidden="true" />
            {t('common.back', 'Back')}
          </Button>
          <div className="text-xs font-medium text-dim">
            {t('bootstrap.stepOf', 'Step {{current}} of {{total}}', {
              current: currentPage + 1,
              total: sections.length,
            })}
          </div>
          {isLastPage ? (
            <Button type="button" onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Rocket aria-hidden="true" />}
              {t('bootstrap.finishSetup', 'Finish setup')}
            </Button>
          ) : (
            <Button type="button" onClick={handleNext} disabled={saving}>
              {t('common.next', 'Next')}
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </WizardShell>
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
