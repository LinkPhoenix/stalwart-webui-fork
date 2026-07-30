/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import React from 'react';

const BACKEND_ICONS: Record<string, { path: string; isIco?: boolean }> = {
  alibaba: { path: '/icons/backends/alibaba.svg' },
  alibabacloud: { path: '/icons/backends/alibaba.svg' },
  aws: { path: '/icons/backends/aws-light.svg' },
  amazonwebservices: { path: '/icons/backends/aws-light.svg' },
  azure: { path: '/icons/backends/azure.ico', isIco: true },
  baidu: { path: '/icons/backends/baiducloud-color.svg' },
  baiducloud: { path: '/icons/backends/baiducloud-color.svg' },
  bunny: { path: '/icons/backends/bunny.svg' },
  bunnynet: { path: '/icons/backends/bunny.svg' },
  cloudflare: { path: '/icons/backends/cloudflare.svg' },
  digitalocean: { path: '/icons/backends/digital-ocean.svg' },
  dnsimple: { path: '/icons/backends/dnsimple.svg' },
  foundationdb: { path: '/icons/backends/foundationdb.svg' },
  google: { path: '/icons/backends/google.svg' },
  googlecloud: { path: '/icons/backends/google.svg' },
  mariadb: { path: '/icons/backends/mysql.svg' },
  mysql: { path: '/icons/backends/mysql.svg' },
  ovh: { path: '/icons/backends/ovh.svg' },
  porkbun: { path: '/icons/backends/porkbun.png' },
  postgres: { path: '/icons/backends/postgresql.svg' },
  postgresql: { path: '/icons/backends/postgresql.svg' },
  quad9: { path: '/icons/backends/quad9.svg' },
  redis: { path: '/icons/backends/redis.svg' },
  rediscluster: { path: '/icons/backends/redis.svg' },
  redissentinel: { path: '/icons/backends/redis.svg' },
  redisvalkey: { path: '/icons/backends/redis.svg' },
  rocksdb: { path: '/icons/backends/rocksdb.svg' },
  sqlite: { path: '/icons/backends/sqlite.svg' },
  valkey: { path: '/icons/backends/valkey.svg' },
  vercel: { path: '/icons/backends/vercel.svg' },
};

interface BackendIconProps {
  backend: string | null | undefined;
  className?: string;
  fallback?: React.ReactNode;
}

export function BackendIcon({ backend, className, fallback = null }: BackendIconProps): React.ReactElement | null {
  if (!backend) return null;

  const key = backend.toLowerCase().replace(/[^a-z0-9]/g, '');
  const icon = BACKEND_ICONS[key] ?? BACKEND_ICONS[backend.toLowerCase()];
  if (!icon) return fallback as React.ReactElement | null;

  return (
    <img
      src={icon.path}
      alt={`${backend} icon`}
      className={className ?? 'h-4 w-4 object-contain'}
      loading="lazy"
    />
  );
}

export function isBackendIconKnown(backend: string | null | undefined): boolean {
  if (!backend) return false;
  const key = backend.toLowerCase().replace(/[^a-z0-9]/g, '');
  return Boolean(BACKEND_ICONS[key] ?? BACKEND_ICONS[backend.toLowerCase()]);
}
