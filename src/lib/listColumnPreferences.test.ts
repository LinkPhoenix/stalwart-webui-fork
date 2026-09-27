import { describe, expect, it } from 'vitest';
import { parseListColumnPreferences } from './listColumnPreferences';

describe('parseListColumnPreferences', () => {
  it('returns defaults when no saved preferences exist', () => {
    expect(parseListColumnPreferences(null)).toEqual({ order: [], hidden: [] });
  });

  it('parses valid column preferences', () => {
    expect(parseListColumnPreferences('{"order":["email","name"],"hidden":["aliases"]}')).toEqual({
      order: ['email', 'name'],
      hidden: ['aliases'],
    });
  });

  it.each(['not json', 'null', '[]', '"columns"'])('falls back for invalid stored JSON: %s', (raw) => {
    expect(parseListColumnPreferences(raw)).toEqual({ order: [], hidden: [] });
  });

  it('drops malformed entries from otherwise valid preferences', () => {
    expect(parseListColumnPreferences('{"order":["email",3,"email"],"hidden":"aliases"}')).toEqual({
      order: ['email'],
      hidden: [],
    });
  });
});
