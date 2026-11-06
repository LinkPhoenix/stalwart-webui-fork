/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

export interface Trace {
  events: TraceEvent[];
}

export interface TraceEvent {
  event: string;
  keyValues: TraceKeyValue[];
  timestamp: string;
}

export interface TraceKeyValue {
  key: string;
  value: TraceValue;
}

export type TraceValue =
  | { '@type': 'String'; value: string }
  | { '@type': 'UnsignedInt'; value: number }
  | { '@type': 'Integer'; value: number }
  | { '@type': 'Boolean'; value: boolean }
  | { '@type': 'Float'; value: number }
  | { '@type': 'UTCDateTime'; value: string }
  | { '@type': 'Duration'; value: number }
  | { '@type': 'IpAddr'; value: string }
  | { '@type': 'List'; value: TraceValue[] }
  | { '@type': 'Event'; event: string; value: TraceKeyValue[] }
  | { '@type': 'Null' };
