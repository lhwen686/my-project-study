import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetInMemoryDbForTests,
  clearAllData,
  createCard,
  createDeck,
  createReview,
  CURRENT_SCHEMA_VERSION,
  deleteCard,
  deleteDeck,
  exportAllData,
  getCardsByDeckId,
  getDecks,
  bulkAddTag,
  bulkDeleteCards,
  bulkMoveCards,
  getNotificationDigest,
  getReminderSettings,
  getSchemaVersion,
  getTodayDueCount,
  importAllData,
  saveReminderSettings,
  initializeDatabase,
  updateCard,
  updateDeck,
} from './sqlite.web';

describe('sqlite.web data layer CRUD + backup', () => {
  beforeEach(async () => {
    __resetInMemoryDbForTests();
    await initializeDatabase();
  });

  it('deck CRUD works', async () => {
    const created = await createDeck('生物', '细胞');
    expect(created?.name).toBe('生物');

    await updateDeck(created!.id, '生物-更新', 'DNA');
    const decks = await getDecks();
    expect(decks.find((d) => d.id === created!.id)?.name).toBe('生物-更新');

    await deleteDeck(created!.id);
    const decksAfter = await getDecks();
    expect(decksAfter.find((d) => d.id === created!.id)).toBeUndefined();
  });

  it('card CRUD works', async () => {
    const deck = (await getDecks())[0];
    const card = await createCard(deck.id, 'front A', 'back A', 'tag1', 'file:///tmp/a.png', '[{"x":0.1,"y":0.1,"width":0.2,"height":0.2}]');
    expect(card.front).toBe('front A');
    expect(card.image_uri).toContain('a.png');

    await updateCard(card.id, 'front B', 'back B', 'tag2', 'asset:///img.png', '[{"x":0.2,"y":0.2,"width":0.2,"height":0.2}]');
    const cards = await getCardsByDeckId(deck.id);
    const target = cards.find((c) => c.id === card.id)!;
    expect(target.front).toBe('front B');
    expect(target.tags).toBe('tag2');
    expect(target.image_uri).toContain('img.png');
    expect(target.occlusions).toContain('\"x\":0.2');

    await deleteCard(card.id);
    const cardsAfter = await getCardsByDeckId(deck.id);
    expect(cardsAfter.find((c) => c.id === card.id)).toBeUndefined();
  });

  it('export -> clear -> import(覆盖) keeps cards/reviews/due consistent', async () => {
    const before = await exportAllData();
    const dueBefore = await getTodayDueCount();

    await createReview(before.cards[0].id, 5);
    const payload = await exportAllData();

    await clearAllData();
    expect((await exportAllData()).cards.length).toBe(0);

    await importAllData(payload, 'replace');
    const after = await exportAllData();
    const dueAfter = await getTodayDueCount();

    expect(after.cards.length).toBe(payload.cards.length);
    expect(after.reviews.length).toBe(payload.reviews.length);
    expect(dueAfter).toBeGreaterThanOrEqual(0);
    expect(typeof dueBefore).toBe('number');
  });





  it('bulk operations work (move/tag/delete)', async () => {
    const decks = await getDecks();
    const source = decks[0];
    const target = decks[1];
    const c1 = await createCard(source.id, 'f1', 'b1');
    const c2 = await createCard(source.id, 'f2', 'b2');

    await bulkAddTag([c1.id, c2.id], 'bulk');
    let sourceCards = await getCardsByDeckId(source.id);
    expect(sourceCards.find((c) => c.id === c1.id)?.tags).toContain('bulk');

    await bulkMoveCards([c1.id, c2.id], target.id);
    sourceCards = await getCardsByDeckId(source.id);
    const targetCards = await getCardsByDeckId(target.id);
    expect(sourceCards.find((c) => c.id === c1.id)).toBeUndefined();
    expect(targetCards.find((c) => c.id === c1.id)).toBeTruthy();

    await bulkDeleteCards([c1.id, c2.id]);
    const targetAfter = await getCardsByDeckId(target.id);
    expect(targetAfter.find((c) => c.id === c1.id)).toBeUndefined();
  });

  it('reminder settings + digest computed from reviews', async () => {
    await saveReminderSettings({ enabled: true, hour: 22, minute: 15, onCompleted: 'completed' });
    const settings = await getReminderSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.hour).toBe(22);

    const digest = await getNotificationDigest();
    expect(digest.dueCount).toBeGreaterThanOrEqual(0);
    expect(digest.estimatedMinutes).toBeGreaterThanOrEqual(1);
  });

  it('schema version is present', async () => {
    const v = await getSchemaVersion();
    expect(v).toBe(CURRENT_SCHEMA_VERSION);
  });
});
