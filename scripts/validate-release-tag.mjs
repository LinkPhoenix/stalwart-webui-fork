import { pathToFileURL } from 'node:url';

const RELEASE_TAG_PATTERN = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

export function isValidReleaseTag(tag) {
  return RELEASE_TAG_PATTERN.test(tag);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!isValidReleaseTag(process.argv[2] ?? '')) {
    console.error('::error::Release tags must use vMAJOR.MINOR.PATCH.');
    process.exitCode = 1;
  }
}
