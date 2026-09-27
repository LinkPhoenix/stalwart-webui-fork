import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/logo', (route) => route.fulfill({ status: 404, body: '' }));
});

test('redirects protected routes to sign-in', async ({ page }) => {
  await page.goto('/settings/x:Account/User?sort=name');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('textbox', { name: 'Enter your account name to continue' })).toBeVisible();
});

test('requires an account name before continuing', async ({ page }) => {
  await page.goto('/login');

  const accountName = page.getByRole('textbox', { name: 'Enter your account name to continue' });
  const continueButton = page.getByRole('button', { name: 'Continue' });

  await expect(accountName).toBeVisible();
  await expect(continueButton).toBeDisabled();

  await accountName.fill('admin@example.test');
  await expect(continueButton).toBeEnabled();
});
