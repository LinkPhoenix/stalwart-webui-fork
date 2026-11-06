/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { stageSeverity, type DeliveryStage } from './types';

const PHASE_PREFIXES: Array<[prefix: string, phase: string]> = [
  ['mxLookup', 'mxLookup'],
  ['mtaStsFetch', 'mtaStsFetch'],
  ['mtaStsNotFound', 'mtaStsFetch'],
  ['tlsRptLookup', 'tlsRptLookup'],
  ['tlsRptNotFound', 'tlsRptLookup'],
  ['mtaStsVerify', 'mtaStsVerify'],
  ['tlsaLookup', 'tlsaLookup'],
  ['tlsaNotFound', 'tlsaLookup'],
  ['ipLookup', 'ipLookup'],
  ['connection', 'connection'],
  ['readGreeting', 'readGreeting'],
  ['ehlo', 'ehlo'],
  ['startTls', 'startTls'],
  ['daneVerify', 'daneVerify'],
  ['mailFrom', 'mailFrom'],
  ['rcptTo', 'rcptTo'],
  ['quit', 'quit'],
];

export function phaseKey(stage: DeliveryStage): string {
  if (stage.type === 'deliveryAttemptStart') return `attempt-${stage.hostname}`;
  for (const [prefix, phase] of PHASE_PREFIXES) {
    if (stage.type.startsWith(prefix)) return phase;
  }
  return stage.type;
}

export interface KeyedStage {
  key: number;
  stage: DeliveryStage;
}

export function pairStages(stages: DeliveryStage[]): KeyedStage[] {
  const result: KeyedStage[] = [];
  const pendingByPhase = new Map<string, number>();
  stages.forEach((stage, index) => {
    const phase = phaseKey(stage);
    if (stageSeverity(stage) === 'pending') {
      pendingByPhase.set(phase, result.length);
      result.push({ key: index, stage });
      return;
    }
    const pendingIdx = pendingByPhase.get(phase);
    if (pendingIdx === undefined) {
      result.push({ key: index, stage });
    } else {
      result[pendingIdx] = { key: result[pendingIdx].key, stage };
      pendingByPhase.delete(phase);
    }
  });
  return result;
}

export interface AttemptGroup {
  key: number;
  attempt: KeyedStage | null;
  stages: KeyedStage[];
}

export function groupByAttempt(stages: KeyedStage[]): AttemptGroup[] {
  const groups: AttemptGroup[] = [];
  let current: AttemptGroup = { key: -1, attempt: null, stages: [] };
  for (const item of stages) {
    if (item.stage.type === 'deliveryAttemptStart') {
      if (current.attempt || current.stages.length > 0) groups.push(current);
      current = { key: item.key, attempt: item, stages: [] };
    } else {
      current.stages.push(item);
    }
  }
  if (current.attempt || current.stages.length > 0) groups.push(current);
  return groups;
}

export interface DeliverySummary {
  attempts: number;
  delivered: boolean;
}

export function summarizeDelivery(stages: DeliveryStage[]): DeliverySummary {
  return {
    attempts: stages.filter((s) => s.type === 'deliveryAttemptStart').length,
    delivered: stages.some((s) => s.type === 'rcptToSuccess' || s.type === 'quitCompleted'),
  };
}

export function isValidTarget(input: string): boolean {
  const target = input.trim();
  if (!target) return false;
  const at = target.lastIndexOf('@');
  if (at === -1) return target.includes('.');
  const local = target.slice(0, at);
  const domain = target.slice(at + 1);
  return local.length > 0 && domain.length > 0 && domain.includes('.');
}

function isDeliveryStage(value: unknown): value is DeliveryStage {
  return !!value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string';
}

export interface DeliveryBatch {
  stages: DeliveryStage[];
  completed: boolean;
}

export function parseDeliveryBatch(data: string): DeliveryBatch {
  const parsed: unknown = JSON.parse(data);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (!items.every(isDeliveryStage)) throw new TypeError('Unexpected delivery trace payload');
  const done = items.findIndex((s) => s.type === 'completed');
  return done === -1 ? { stages: items, completed: false } : { stages: items.slice(0, done), completed: true };
}
