/** Return the optional token bypass only while running Vite's development server. */
export function getDevelopmentAccessToken(isDevelopment: boolean, token: string | undefined): string | undefined {
  if (!isDevelopment) return undefined;
  const normalized = token?.trim();
  return normalized || undefined;
}

/** Refuse to bundle the development-only token into any production build. */
export function assertNoDevelopmentTokenInBuild(command: string, token: string | undefined): void {
  if (command === 'build' && token?.trim()) {
    throw new Error('VITE_ACCESS_TOKEN is supported only by the Vite development server; remove it before building.');
  }
}
