import { expect, test, type Page } from '@playwright/test';
import type { Schema } from '../src/types/schema';

const schema: Schema = {
  objects: { 'x:Log': { type: 'object', description: 'Logs', permissionPrefix: 'sysLog' } },
  schemas: { 'x:Log': { type: 'single', schemaName: 'LogFields' } },
  fields: {
    LogFields: {
      properties: {
        name: { description: 'Name', type: { type: 'string', format: 'string' }, update: 'mutable' },
      },
    },
  },
  lists: {
    'x:Log': {
      title: 'Log Entries',
      subtitle: '',
      singularName: 'entry',
      pluralName: 'entries',
      columns: [{ name: 'name', label: 'Name' }],
      filters: [{ type: 'text', field: 'name', label: 'Name' }],
      massActions: [{ type: 'delete', label: 'Delete selected' }],
      itemActions: [
        { type: 'setProperty', label: 'Mark entry', properties: { marked: true } },
        { type: 'delete', label: 'Delete entry' },
      ],
    },
  },
  layouts: [
    { name: 'Management', icon: 'settings', items: [{ link: { name: 'Logs', icon: 'list', viewName: 'x:Log' } }] },
  ],
  forms: {},
  enums: { TracingLevel: [{ name: 'info', label: 'Info' }], EventType: [{ name: 'received', label: 'Received' }] },
  dashboards: [],
};

async function openList(page: Page, queryString = '', objectName = 'x:Log') {
  const rows = Array.from({ length: 130 }, (_, index) => ({
    id: `row-${index + 1}`,
    name: `Entry ${String(index + 1).padStart(3, '0')}`,
    level: 'info',
    event: 'received',
  }));
  const fixture = { queries: [] as Record<string, unknown>[], failNextQuery: false };
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'stalwart-auth',
      JSON.stringify({
        state: {
          accessToken: 'synthetic-test-token',
          tokenExpiresAt: Date.now() + 3_600_000,
        },
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
  const fixtureSchema: Schema = {
    ...schema,
    objects: { [objectName]: schema.objects['x:Log'] },
    schemas: { [objectName]: schema.schemas['x:Log'] },
    lists: { [objectName]: schema.lists['x:Log'] },
    layouts: [
      {
        name: 'Management',
        icon: 'settings',
        items: [{ link: { name: 'Entries', icon: 'list', viewName: objectName } }],
      },
    ],
  };
  await page.route('**/api/schema', (route) => route.fulfill({ json: fixtureSchema }));
  await page.route('**/api/account', (route) =>
    route.fulfill({
      json: {
        permissions: ['sysLogGet', 'sysLogUpdate', 'sysLogDestroy'],
        edition: 'enterprise',
        locale: 'en',
      },
    }),
  );
  await page.route('**/jmap', async (route) => {
    const calls = route.request().postDataJSON().methodCalls as [string, Record<string, unknown>, string][];
    const query = calls.find(([method]) => method === `${objectName}/query`);
    if (!query) {
      const destroyed = (calls[0][1].destroy as string[] | undefined) ?? [];
      for (const id of destroyed) {
        const index = rows.findIndex((row) => row.id === id);
        if (index !== -1) rows.splice(index, 1);
      }
      await route.fulfill({
        json: {
          methodResponses: calls.map(([method, args, id]) => [
            method,
            method === `${objectName}/get`
              ? { list: rows.filter((row) => (args.ids as string[]).includes(row.id)).reverse() }
              : method.endsWith('/set')
                ? {
                    destroyed,
                    updated: Object.fromEntries(
                      Object.keys((args.update as Record<string, unknown>) ?? {}).map((itemId) => [itemId, null]),
                    ),
                  }
                : { list: [], ids: [], total: 0 },
            id,
          ]),
        },
      });
      return;
    }
    const options = query[1];
    fixture.queries.push(options);
    if (options.anchor && !rows.some((row) => row.id === options.anchor)) {
      await route.fulfill({
        json: {
          methodResponses: [
            ['error', { type: 'anchorNotFound' }, '0'],
            ['error', { type: 'invalidResultReference' }, '1'],
          ],
        },
      });
      return;
    }
    if (fixture.failNextQuery) {
      fixture.failNextQuery = false;
      await route.fulfill({
        json: {
          methodResponses: [
            ['error', { type: 'serverFail' }, '0'],
            ['error', { type: 'serverFail' }, '1'],
          ],
        },
      });
      return;
    }
    const filtered = (options.filter as Record<string, unknown> | undefined)?.name
      ? rows.filter((row) => row.name === (options.filter as Record<string, unknown>).name)
      : rows;
    const position = options.anchor
      ? filtered.findIndex((row) => row.id === options.anchor) + Number(options.anchorOffset ?? 0)
      : Number(options.position ?? 0);
    const pageRows = filtered.slice(position, position + Number(options.limit ?? filtered.length));
    await route.fulfill({
      json: {
        methodResponses: [
          [`${objectName}/query`, { ids: pageRows.map((row) => row.id), total: filtered.length, position }, query[2]],
          // /get ordering is deliberately different from /query (RFC 8620 §5.1).
          [`${objectName}/get`, { list: [...pageRows].reverse() }, '1'],
        ],
      },
    });
  });
  await page.goto(`/Management/${objectName}${queryString}`);
  await expectPage(page, 1);
  return fixture;
}

async function expectPage(page: Page, start: number, size = 25) {
  await expect(page.getByRole('cell', { name: /^Entry / })).toHaveText(
    Array.from({ length: size }, (_, index) => `Entry ${String(start + index).padStart(3, '0')}`),
  );
}

test('returns one page at a time and preserves the page when refreshed or updated', async ({ page }) => {
  const fixture = await openList(page);
  await page.clock.install();
  for (const start of [26, 51, 76]) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expectPage(page, start);
    if (start === 26) {
      const count = fixture.queries.length;
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect.poll(() => fixture.queries.length).toBe(count + 1);
      expect(fixture.queries.at(-1)).toMatchObject({ anchor: 'row-26', anchorOffset: 0 });
      await expectPage(page, 26);
    }
  }
  const queryCount = fixture.queries.length;
  for (const start of [51, 26]) {
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expectPage(page, start);
  }
  expect(fixture.queries).toHaveLength(queryCount);
  await page.clock.fastForward(5_100);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(() => fixture.queries.length).toBe(queryCount + 1);
  expect(fixture.queries.at(-1)).toMatchObject({ anchor: 'row-26', anchorOffset: 0 });
  await expectPage(page, 26);
  await page.getByRole('button', { name: 'Actions for this item' }).first().click();
  await page.getByRole('menuitem', { name: 'Mark entry' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect.poll(() => fixture.queries.length).toBe(queryCount + 2);
  await expectPage(page, 26);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expectPage(page, 1);
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expectPage(page, 26);
});

test('failed requests keep the current page and page-size changes clear history', async ({ page }) => {
  const fixture = await openList(page);
  fixture.failNextQuery = true;
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('serverFail', { exact: true })).toBeVisible();
  await expectPage(page, 1);
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expectPage(page, 26);
  fixture.failNextQuery = true;
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByText('serverFail', { exact: true })).toBeVisible();
  await expectPage(page, 26);
  await page.getByRole('combobox', { name: 'Rows per page' }).click();
  await page.getByRole('option', { name: '50', exact: true }).click();
  await expectPage(page, 1, 50);
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expectPage(page, 51, 50);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expectPage(page, 1, 50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expectPage(page, 51, 50);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Entry 003');
  await page.getByLabel('Name', { exact: true }).press('Enter');
  await expectPage(page, 3, 1);
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
});

test('deleting the refresh anchor reloads the current page without an anchor error', async ({ page }) => {
  const fixture = await openList(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expectPage(page, 26);
  await page.getByRole('button', { name: 'Actions for this item' }).first().click();
  await page.getByRole('menuitem', { name: 'Delete entry' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expectPage(page, 27);
  expect(fixture.queries.at(-1)).toMatchObject({ position: 25 });
  expect(fixture.queries.at(-1)).not.toHaveProperty('anchor');
  await expect(page.getByText('anchorNotFound', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expectPage(page, 52);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expectPage(page, 27);
});

test('client-filtered lists retain order and the current page after refresh', async ({ page }) => {
  const fixture = await openList(page, '?f.level=info');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expectPage(page, 26);
  const queryCount = fixture.queries.length;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(() => fixture.queries.length).toBeGreaterThan(queryCount);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await expectPage(page, 26);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expectPage(page, 1);
});

test('log auto-refresh pauses on later pages and resumes on returning to page one', async ({ page }) => {
  const fixture = await openList(page);
  await page.clock.install();
  await page.getByRole('switch', { name: 'Auto-refresh' }).click();
  let queryCount = fixture.queries.length;
  await page.clock.fastForward(11_000);
  await expect.poll(() => fixture.queries.length).toBe(queryCount + 1);
  await expectPage(page, 1);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expectPage(page, 26);
  queryCount = fixture.queries.length;
  await page.clock.fastForward(30_000);
  expect(fixture.queries).toHaveLength(queryCount);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expectPage(page, 1);
  queryCount = fixture.queries.length;
  await page.clock.fastForward(11_000);
  await expect.poll(() => fixture.queries.length).toBe(queryCount + 1);
  expect(fixture.queries.at(-1)).toMatchObject({ position: 0 });
});

test('ordinary schema-driven lists share the navigation and action fixes', async ({ page }) => {
  await openList(page, '', 'x:Fixture');
  for (const start of [26, 51]) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expectPage(page, start);
  }
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expectPage(page, 26);
  await page.getByRole('button', { name: 'Actions for this item' }).first().click();
  await page.getByRole('menuitem', { name: 'Mark entry' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await expectPage(page, 26);
});

test('deleting the last page reveals the previous page and clears selections', async ({ page }) => {
  const fixture = await openList(page);
  for (const start of [26, 51, 76, 101, 126]) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expectPage(page, start, start === 126 ? 5 : 25);
  }
  await page.getByRole('checkbox', { name: 'Select all', exact: true }).check();
  await page.getByRole('button', { name: 'Actions (5)', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete selected', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expectPage(page, 101);
  expect(fixture.queries.at(-1)).toMatchObject({ position: 100 });
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Select all', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expectPage(page, 76);
});

test('actions on all matching rows invalidate cached pages', async ({ page }) => {
  const fixture = await openList(page);
  for (const start of [26, 51]) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expectPage(page, start);
  }
  await page.getByRole('checkbox', { name: 'Select all', exact: true }).check();
  await page.getByRole('button', { name: 'Select all 130 items matching filters', exact: true }).click();
  await page.getByRole('button', { name: 'Actions (130)', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete selected', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await expect(page.getByRole('cell', { name: /^Entry / })).toHaveCount(0);
  expect(fixture.queries.at(-1)).toMatchObject({ position: 0 });
});
