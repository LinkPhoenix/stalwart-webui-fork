import { expect, test, type Page } from '@playwright/test';

import type { Schema } from '../src/types/schema';

const schema: Schema = {
  objects: {
    'x:Account': { type: 'object', description: 'Accounts', permissionPrefix: 'account' },
    'x:Account/User': { type: 'view', objectName: 'x:Account' },
    'x:Account/Group': { type: 'view', objectName: 'x:Account' },
    'x:Domain': { type: 'object', description: 'Domains', permissionPrefix: 'domain' },
  },
  schemas: {
    'x:Account': { type: 'single', schemaName: 'AccountFields' },
    'x:Domain': { type: 'single', schemaName: 'DomainFields' },
  },
  fields: {
    AccountFields: { properties: {} },
    DomainFields: { properties: {} },
  },
  lists: {
    'x:Domain': {
      title: 'Domains',
      subtitle: '',
      singularName: 'domain',
      pluralName: 'domains',
      columns: [{ name: 'name', label: 'Name' }],
      filters: [],
      massActions: [],
      itemActions: [],
    },
  },
  layouts: [
    {
      name: 'Management',
      icon: 'settings',
      items: [{ link: { name: 'Domains', icon: 'globe', viewName: 'x:Domain' } }],
    },
  ],
  forms: {},
  enums: {},
  dashboards: [],
};

const TOTALS: Record<string, number> = { 'x:Account': 7, 'x:Domain': 3 };

async function mockBackend(page: Page) {
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
    route.fulfill({ json: { permissions: ['accountQuery', 'domainQuery'], edition: 'community', locale: 'en' } }),
  );
  await page.route('**/jmap', (route) => {
    const calls = route.request().postDataJSON().methodCalls as [string, Record<string, unknown>, string][];
    route.fulfill({
      json: {
        methodResponses: calls.map(([method, args, id]) => {
          const objectType = method.split('/')[0];
          if (method === `${objectType}/query`) {
            return [method, { accountId: args.accountId, list: [], ids: [], position: 0, total: TOTALS[objectType] ?? 0 }, id];
          }
          if (method === `${objectType}/get`) {
            return [method, { accountId: args.accountId, list: [], notFound: [] }, id];
          }
          return [method, {}, id];
        }),
      },
    });
  });
}

test('overview shows queryable cards with their totals', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');

  await page.getByRole('link', { name: 'Overview' }).click();
  await expect(page).toHaveURL(/CustomComponent\/Overview/);

  const usersCard = page.getByRole('link', { name: /Users/ });
  await expect(usersCard).toBeVisible();
  await expect(usersCard.getByText('7')).toBeVisible();

  const domainsCard = page.getByRole('link', { name: /Domains/ });
  await expect(domainsCard).toBeVisible();
  await expect(domainsCard.getByText('3')).toBeVisible();
});

test('overview hides cards the account cannot query', async ({ page }) => {
  await mockBackend(page);
  await page.route('**/api/account', (route) =>
    route.fulfill({ json: { permissions: ['domainQuery'], edition: 'community', locale: 'en' } }),
  );
  await page.goto('/');

  await page.getByRole('link', { name: 'Overview' }).click();
  await expect(page).toHaveURL(/CustomComponent\/Overview/);

  await expect(page.getByRole('link', { name: /Domains/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Users/ })).toHaveCount(0);
});
