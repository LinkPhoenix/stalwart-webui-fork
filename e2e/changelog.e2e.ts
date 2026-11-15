import { expect, test } from '@playwright/test';

import type { Schema } from '../src/types/schema';

const schema: Schema = {
  objects: {},
  schemas: {},
  fields: {},
  lists: {},
  layouts: [],
  forms: {},
  enums: {},
  dashboards: [],
};

test('changelog page loads its lazy chunk and renders the release notes', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'stalwart-auth',
      JSON.stringify({
        state: { accessToken: 'synthetic-test-token', tokenExpiresAt: Date.now() + 3_600_000 },
        version: 0,
      }),
    );
  });
  await page.route('**/logo', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('**/jmap/session', (route) =>
    route.fulfill({
      json: {
        accounts: { test: { name: 'Test account', isPersonal: true } },
        primaryAccounts: { 'urn:ietf:params:jmap:core': 'test' },
        apiUrl: '/jmap',
      },
    }),
  );
  await page.route('**/api/schema', (route) => route.fulfill({ json: schema }));
  await page.route('**/api/account', (route) =>
    route.fulfill({ json: { permissions: [], edition: 'community', locale: 'en' } }),
  );
  await page.route('**/jmap', (route) => route.fulfill({ json: { methodResponses: [] } }));

  await page.goto('/Changelog');

  await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible();
  // The rendered markdown comes from CHANGELOG.md: version headings must be present.
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
});
