/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { jmapGetBatched } from '@/services/jmap/client';
import { coerceLabel } from '@/lib/objectOptions';

interface Waiter {
  resolve: (label: string | null) => void;
  reject: (err: unknown) => void;
}

interface Pending {
  objectName: string;
  displayProperty: string;
  waiters: Map<string, Set<Waiter>>;
  controller: AbortController;
}

const pendingBatches = new Map<string, Pending>();

async function runBatch(batch: Pending): Promise<void> {
  const ids = Array.from(batch.waiters.keys());
  if (ids.length === 0) return;
  try {
    const items = await jmapGetBatched(batch.objectName, ids, ['id', batch.displayProperty], {
      signal: batch.controller.signal,
    });
    const labels = new Map<string, string>();
    for (const item of items) {
      const id = item.id;
      if (typeof id === 'string') labels.set(id, coerceLabel(item[batch.displayProperty], id));
    }
    for (const [id, waiters] of batch.waiters) {
      const label = labels.get(id) ?? null;
      for (const w of waiters) w.resolve(label);
    }
  } catch (err) {
    for (const waiters of batch.waiters.values()) {
      for (const w of waiters) w.reject(err);
    }
  }
}

export function loadDisplayName(
  objectName: string,
  displayProperty: string,
  id: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  const batchKey = `${objectName}\u0000${displayProperty}`;
  let batch = pendingBatches.get(batchKey);
  if (!batch) {
    const created: Pending = { objectName, displayProperty, waiters: new Map(), controller: new AbortController() };
    pendingBatches.set(batchKey, created);
    batch = created;
    queueMicrotask(() => {
      if (pendingBatches.get(batchKey) === created) pendingBatches.delete(batchKey);
      void runBatch(created);
    });
  }
  const target = batch;
  return new Promise((resolve, reject) => {
    const waiter: Waiter = { resolve, reject };
    let waiters = target.waiters.get(id);
    if (!waiters) {
      waiters = new Set();
      target.waiters.set(id, waiters);
    }
    waiters.add(waiter);
    signal?.addEventListener(
      'abort',
      () => {
        const current = target.waiters.get(id);
        current?.delete(waiter);
        if (current?.size === 0) target.waiters.delete(id);
        reject(signal.reason);
        if (target.waiters.size === 0) target.controller.abort(signal.reason);
      },
      { once: true },
    );
  });
}
