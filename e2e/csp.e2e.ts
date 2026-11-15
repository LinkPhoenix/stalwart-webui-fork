import { expect, test, type Page } from '@playwright/test';

import type { Schema } from '../src/types/schema';

// The policy is only injected into production builds: run with E2E_TARGET=build (see playwright.config.ts).
test.skip(process.env.E2E_TARGET !== 'build', 'The Content-Security-Policy only exists in production builds.');

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

/** Records every violation the browser reports, from the first script that runs. */
async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = violations;
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.violatedDirective} blocked ${event.blockedURI || 'inline'}`);
    });
  });
}

async function violations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);
}

test.beforeEach(async ({ page }) => {
  await recordViolations(page);
  await page.route('**/logo', (route) => route.fulfill({ status: 404, body: '' }));
});

test('the built page ships a policy that forbids inline and remote scripts', async ({ page }) => {
  await page.goto('/login');

  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("script-src 'self'");
  expect(policy).not.toContain('unsafe-eval');
  expect(policy).toContain("object-src 'none'");
});

test('the sign-in page loads without any policy violation', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('textbox', { name: 'Enter your account name to continue' })).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

test('an injected inline script does not run', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__injectedScriptRan = true';
    document.head.append(script);
  });

  expect(await page.evaluate(() => (window as unknown as { __injectedScriptRan?: boolean }).__injectedScriptRan)).toBe(
    undefined,
  );
  expect(await violations(page)).toHaveLength(1);
});

test('the signed-in shell and the lazy Changelog page load without any policy violation', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'stalwart-auth',
      JSON.stringify({
        state: { accessToken: 'synthetic-test-token', tokenExpiresAt: Date.now() + 3_600_000 },
        version: 0,
      }),
    );
  });
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

  expect(await violations(page)).toEqual([]);
});
