import { expect, test, type Page } from '@playwright/test';

const IDENTITY_PROVIDER = 'https://sso.example.test';

test.beforeEach(async ({ page }) => {
  await page.route('**/logo', (route) => route.fulfill({ status: 404, body: '' }));
});

async function signInAs(page: Page, account: string) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Enter your account name to continue' }).fill(account);
  await page.getByRole('button', { name: 'Continue' }).click();
}

test('sign-in redirects to the identity provider with the PKCE parameters, keeping its own query', async ({ page }) => {
  await page.route('**/api/discover/**', (route) =>
    route.fulfill({
      json: {
        authorization_endpoint: `${IDENTITY_PROVIDER}/login/oauth/authorize?organization=acme`,
        token_endpoint: `${IDENTITY_PROVIDER}/api/login/oauth/access_token`,
        client_id_metadata_document_supported: true,
      },
    }),
  );
  await page.route(`${IDENTITY_PROVIDER}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Identity provider</title>' }),
  );

  await signInAs(page, 'admin@example.test');

  await page.waitForURL(`${IDENTITY_PROVIDER}/**`);
  const target = new URL(page.url());
  expect(target.pathname).toBe('/login/oauth/authorize');
  expect(target.searchParams.get('organization')).toBe('acme');
  expect(target.searchParams.get('response_type')).toBe('code');
  expect(target.searchParams.get('code_challenge_method')).toBe('S256');
  expect(target.searchParams.get('code_challenge')).toBeTruthy();
});

test('sign-in refuses a discovery answer whose endpoint would run script', async ({ page }) => {
  await page.route('**/api/discover/**', (route) =>
    route.fulfill({
      json: {
        authorization_endpoint: 'javascript:window.__discoveryScriptRan = true',
        token_endpoint: `${IDENTITY_PROVIDER}/token`,
        client_id_metadata_document_supported: true,
      },
    }),
  );

  await signInAs(page, 'admin@example.test');

  await expect(page.getByRole('alert')).toContainText('invalid sign-in endpoints');
  expect(await page.evaluate(() => (window as unknown as { __discoveryScriptRan?: boolean }).__discoveryScriptRan)).toBe(
    undefined,
  );
  await expect(page).toHaveURL(/\/login$/);
});

test('sign-in refuses a discovery answer that is not JSON', async ({ page }) => {
  await page.route('**/api/discover/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html>Bad gateway</html>' }),
  );

  await signInAs(page, 'admin@example.test');

  await expect(page.getByRole('alert')).toContainText('invalid sign-in endpoints');
});
