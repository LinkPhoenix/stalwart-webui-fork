/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import React from 'react';

const BACKEND_ICONS: Record<string, { path: string; isIco?: boolean }> = {
  // Storage / database backends
  foundationdb: { path: '/icons/backends/foundationdb.svg' },
  mariadb: { path: '/icons/backends/mysql.svg' },
  mysql: { path: '/icons/backends/mysql.svg' },
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

  // Cloud / DNS providers with official icons
  alibaba: { path: '/icons/backends/alibaba.svg' },
  alibabacloud: { path: '/icons/backends/alibaba.svg' },
  alidns: { path: '/icons/backends/alibaba.svg' },
  amazonwebservices: { path: '/icons/backends/aws-light.svg' },
  aws: { path: '/icons/backends/aws-light.svg' },
  lightsail: { path: '/icons/backends/aws-light.svg' },
  route53: { path: '/icons/backends/aws-light.svg' },
  azure: { path: '/icons/backends/azure.ico', isIco: true },
  azuredns: { path: '/icons/backends/azure.ico', isIco: true },
  baidu: { path: '/icons/backends/baiducloud-color.svg' },
  baiducloud: { path: '/icons/backends/baiducloud-color.svg' },
  bunny: { path: '/icons/backends/bunny.svg' },
  bunnynet: { path: '/icons/backends/bunny.svg' },
  cloudflare: { path: '/icons/backends/cloudflare.svg' },
  cpanel: { path: '/icons/backends/cpanel.svg' },
  digitalocean: { path: '/icons/backends/digital-ocean.svg' },
  dnsimple: { path: '/icons/backends/dnsimple.svg' },
  duckdns: { path: '/icons/backends/duckdns.svg' },
  dynu: { path: '/icons/backends/dynu.png' },
  google: { path: '/icons/backends/google.svg' },
  googleclouddns: { path: '/icons/backends/google-cloud.svg' },
  googlecloud: { path: '/icons/backends/google-cloud.svg' },
  ibm: { path: '/icons/backends/ibm.svg' },
  ibmcloud: { path: '/icons/backends/ibm.svg' },
  ionos: { path: '/icons/backends/ionos.svg' },
  linode: { path: '/icons/backends/linode.svg' },
  oracle: { path: '/icons/backends/oracle-cloud.svg' },
  oraclecloud: { path: '/icons/backends/oracle-cloud.svg' },
  ovh: { path: '/icons/backends/ovh.svg' },
  plesk: { path: '/icons/backends/plesk.svg' },
  porkbun: { path: '/icons/backends/porkbun.png' },
  scaleway: { path: '/icons/backends/scaleway.svg' },
  tencent: { path: '/icons/backends/tencentcloud-color.svg' },
  tencentcloud: { path: '/icons/backends/tencentcloud-color.svg' },
  vercel: { path: '/icons/backends/vercel.svg' },
  vultr: { path: '/icons/backends/vultr.svg' },
  yandex: { path: '/icons/backends/yandex.svg' },
  yandexcloud: { path: '/icons/backends/yandex.svg' },
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
