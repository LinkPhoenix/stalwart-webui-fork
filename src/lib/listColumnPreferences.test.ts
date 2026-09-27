import { describe, expect, it } from 'vitest';
import { moveListColumn, parseListColumnPreferences } from './listColumnPreferences';

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

describe('moveListColumn', () => {
  it('moves a visible column earlier or later', () => {
    expect(moveListColumn(['name', 'email', 'aliases'], 'email', -1)).toEqual(['email', 'name', 'aliases']);
    expect(moveListColumn(['name', 'email', 'aliases'], 'email', 1)).toEqual(['name', 'aliases', 'email']);
  });

  it('keeps the order when the move would go past an edge or the column is missing', () => {
    const order = ['name', 'email'];
    expect(moveListColumn(order, 'name', -1)).toBe(order);
    expect(moveListColumn(order, 'email', 1)).toBe(order);
    expect(moveListColumn(order, 'aliases', -1)).toBe(order);
  });
});
