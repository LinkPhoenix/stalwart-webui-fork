/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState, type Dispatch, type SetStateAction } from 'react';

export function useBufferedValue<T, S = T>(
  value: T,
  transform: (v: T) => S = (v) => v as unknown as S,
): [S, Dispatch<SetStateAction<S>>] {
  const [prev, setPrev] = useState(value);
  const [local, setLocal] = useState<S>(() => transform(value));
  if (!Object.is(value, prev)) {
    setPrev(value);
    setLocal(transform(value));
  }
  return [local, setLocal];
}

export function useResetOnChange<K>(key: K, reset: () => void): void {
  const [prev, setPrev] = useState(key);
  if (!Object.is(key, prev)) {
    setPrev(key);
    reset();
  }
}
