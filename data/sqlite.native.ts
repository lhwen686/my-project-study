import * as SQLite from 'expo-sqlite';

import { parseCardsCsv } from './csv';
import { calculateSm2 } from './sm2';

export const CURRENT_SCHEMA_VERSION = 1;

export type Deck = { id: number; name: string; description: string | null; created_at: string };
export type Occlusion = { x: number; y: number; width: number; height: number; label?: string };

export type Card = {
  id: number;
  deck_id: number;
  front: string;
  back: string;
  tags: string | null;
  image_uri: string | null;
  occlusions: string | null;
  repetition: number;
  interval_days: number;
  ease_factor: number;
  due_date: string;
  created_at: string;
  lapse_count?: number;
};
export type Review = { id: number; card_id: number; reviewed_at: string; rating: number; duration_seconds: number };

export type ReminderSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
  onCompleted: 'skip' | 'completed';
};

export type NotificationDigest = {
  dueCount: number;
  estimatedMinutes: number;
  completedToday: boolean;
};

export type ExportPayload = {
  schemaVersion: number;
  exportedAt: string;
  decks: Deck[];
  cards: Card[];
  reviews: Review[];
};

export type DeckMastery = {
  deck_id: number;
  deck_name: string;
  correct: number;
  total: number;
  accuracy: number;
};
export type StatsSummary = {
  dueCount: number;
  lapsesCount: number;
  todayCompleted: number;
  streakDays: number;
  masteryByDeck: DeckMastery[];
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const getDb = async () => (dbPromise ??= SQLite.openDatabaseAsync('review-app.db'));

const seedDecks = [
  { name: '数学', description: '代数与几何复习卡' },
  { name: '英语', description: '词汇与语法复习卡' },
];
const seedCards = [
  { deck: 0, front: '二次函数顶点式', back: 'y = a(x-h)^2 + k' },
  { deck: 0, front: '勾股定理', back: 'a² + b² = c²' },
  { deck: 0, front: '一元二次方程求根公式', back: 'x = (-b ± √(b²-4ac)) / 2a' },
  { deck: 0, front: '正弦定义', back: 'sin θ = 对边 / 斜边' },
  { deck: 0, front: '圆面积公式', back: 'S = πr²' },
  { deck: 1, front: 'abandon', back: '放弃，抛弃' },
  { deck: 1, front: 'derive', back: '推导；源于' },
  { deck: 1, front: 'present perfect tense', back: 'have/has + 过去分词' },
  { deck: 1, front: 'although', back: '虽然；尽管' },
  { deck: 1, front: 'passive voice', back: 'be + 过去分词' },
];

async function ensureCardColumns(db: SQLite.SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(cards);');
  const names = new Set(columns.map((c) => c.name));
  if (!names.has('tags')) await db.execAsync('ALTER TABLE cards ADD COLUMN tags TEXT;');
  if (!names.has('image_uri')) await db.execAsync('ALTER TABLE cards ADD COLUMN image_uri TEXT;');
  if (!names.has('occlusions')) await db.execAsync('ALTER TABLE cards ADD COLUMN occlusions TEXT;');
  if (!names.has('repetition')) await db.execAsync('ALTER TABLE cards ADD COLUMN repetition INTEGER NOT NULL DEFAULT 0;');
  if (!names.has('interval_days')) await db.execAsync('ALTER TABLE cards ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 0;');
  if (!names.has('ease_factor')) await db.execAsync('ALTER TABLE cards ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5;');
  if (!names.has('due_date')) await db.execAsync('ALTER TABLE cards ADD COLUMN due_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;');

  const reviewColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(reviews);');
  const reviewNames = new Set(reviewColumns.map((c) => c.name));
  if (!reviewNames.has('duration_seconds'))
    await db.execAsync('ALTER TABLE reviews ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 30;');
}

async function ensureMetaTable(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );`);
}

async function getMeta(key: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_meta WHERE key = ?;', key);
  return row?.value ?? null;
}

async function setMeta(key: string, value: string) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);', key, value);
}

export async function getSchemaVersion() {
  const value = await getMeta('schemaVersion');
  return value ? Number(value) : 0;
}


export async function getReminderSettings(): Promise<ReminderSettings> {
  const raw = await getMeta('reminderSettings');
  if (!raw) return { enabled: false, hour: 21, minute: 30, onCompleted: 'skip' };
  try {
    return JSON.parse(raw) as ReminderSettings;
  } catch {
    return { enabled: false, hour: 21, minute: 30, onCompleted: 'skip' };
  }
}

export async function saveReminderSettings(settings: ReminderSettings) {
  await setMeta('reminderSettings', JSON.stringify(settings));
}

export async function initializeDatabase() {
  const db = await getDb();
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      tags TEXT,
      image_uri TEXT,
      occlusions TEXT,
      repetition INTEGER NOT NULL DEFAULT 0,
      interval_days INTEGER NOT NULL DEFAULT 0,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      due_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      rating INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 30,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_cards_deck_due ON cards(deck_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_at ON reviews(reviewed_at);
  `);

  await ensureCardColumns(db);
  await ensureMetaTable(db);

  const current = await getSchemaVersion();
  if (current < CURRENT_SCHEMA_VERSION) {
    // future migrations can be added here by stepping from current -> CURRENT_SCHEMA_VERSION
    await setMeta('schemaVersion', String(CURRENT_SCHEMA_VERSION));
  }

  const deckCount = (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM decks;'))?.count ?? 0;
  if (deckCount === 0) {
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      const ids: number[] = [];
      for (const d of seedDecks) {
        const r = await db.runAsync('INSERT INTO decks (name, description) VALUES (?, ?);', d.name, d.description);
        ids.push(r.lastInsertRowId);
      }
      for (const c of seedCards) {
        await db.runAsync('INSERT INTO cards (deck_id, front, back, image_uri, occlusions, due_date) VALUES (?, ?, ?, ?, ?, ?);', ids[c.deck], c.front, c.back, null, null, now);
      }
    });
  }
}

export async function clearAllData() {
  const db = await getDb();
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM reviews;');
    await db.runAsync('DELETE FROM cards;');
    await db.runAsync('DELETE FROM decks;');
  });
  await db.execAsync('PRAGMA foreign_keys = ON;');
}

export async function exportAllData(): Promise<ExportPayload> {
  const db = await getDb();
  return {
    schemaVersion: await getSchemaVersion(),
    exportedAt: new Date().toISOString(),
    decks: await db.getAllAsync<Deck>('SELECT * FROM decks ORDER BY id ASC;'),
    cards: await db.getAllAsync<Card>('SELECT * FROM cards ORDER BY id ASC;'),
    reviews: await db.getAllAsync<Review>('SELECT * FROM reviews ORDER BY id ASC;'),
  };
}

export async function importAllData(payload: ExportPayload, mode: 'merge' | 'replace') {
  const db = await getDb();
  if (mode === 'replace') await clearAllData();

  await db.withTransactionAsync(async () => {
    for (const d of payload.decks) {
      await db.runAsync(
        `INSERT OR ${mode === 'merge' ? 'IGNORE' : 'REPLACE'} INTO decks (id, name, description, created_at) VALUES (?, ?, ?, ?);`,
        d.id,
        d.name,
        d.description,
        d.created_at,
      );
    }

    for (const c of payload.cards) {
      await db.runAsync(
        `INSERT OR ${mode === 'merge' ? 'IGNORE' : 'REPLACE'} INTO cards
          (id, deck_id, front, back, tags, image_uri, occlusions, repetition, interval_days, ease_factor, due_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        c.id,
        c.deck_id,
        c.front,
        c.back,
        c.tags,
        c.image_uri ?? null,
        c.occlusions ?? null,
        c.repetition,
        c.interval_days,
        c.ease_factor,
        c.due_date,
        c.created_at,
      );
    }

    for (const r of payload.reviews) {
      await db.runAsync(
        `INSERT OR ${mode === 'merge' ? 'IGNORE' : 'REPLACE'} INTO reviews (id, card_id, reviewed_at, rating, duration_seconds) VALUES (?, ?, ?, ?, ?);`,
        r.id,
        r.card_id,
        r.reviewed_at,
        r.rating,
        r.duration_seconds ?? 30,
      );
    }
  });

  if ((payload.schemaVersion ?? 0) > CURRENT_SCHEMA_VERSION) {
    await setMeta('schemaVersion', String(payload.schemaVersion));
  } else {
    await setMeta('schemaVersion', String(CURRENT_SCHEMA_VERSION));
  }
}

export async function getDecks() { return (await getDb()).getAllAsync<Deck>('SELECT * FROM decks ORDER BY id ASC;'); }
export async function getDeckById(id: number) { return (await getDb()).getFirstAsync<Deck>('SELECT * FROM decks WHERE id = ?;', id); }
export async function createDeck(name: string, description?: string) {
  const db = await getDb();
  const r = await db.runAsync('INSERT INTO decks (name, description) VALUES (?, ?);', name, description ?? null);
  return getDeckById(r.lastInsertRowId);
}
export async function updateDeck(id: number, name: string, description?: string) {
  await (await getDb()).runAsync('UPDATE decks SET name=?, description=? WHERE id=?;', name, description ?? null, id);
  return getDeckById(id);
}
export async function deleteDeck(id: number) { await (await getDb()).runAsync('DELETE FROM decks WHERE id=?;', id); }

export async function getCardsByDeckId(deckId: number) {
  return (await getDb()).getAllAsync<Card>(
    `SELECT c.*, COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.card_id = c.id AND r.rating = 1), 0) as lapse_count
     FROM cards c WHERE c.deck_id = ? ORDER BY c.id DESC;`,
    deckId,
  );
}

export async function getTodayDueCardsByDeckId(deckId: number, now: Date = new Date()) {
  return (await getDb()).getAllAsync<Card>('SELECT * FROM cards WHERE deck_id = ? AND due_date <= ? ORDER BY due_date ASC, id ASC;', deckId, now.toISOString());
}
export async function getCardById(id: number) {
  return (await getDb()).getFirstAsync<Card>(
    `SELECT c.*, COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.card_id = c.id AND r.rating = 1), 0) as lapse_count
     FROM cards c WHERE c.id = ?;`,
    id,
  );
}

export async function createCard(deckId: number, front: string, back: string, tags?: string, imageUri?: string, occlusions?: string) {
  const db = await getDb();
  const r = await db.runAsync('INSERT INTO cards (deck_id, front, back, tags, image_uri, occlusions, due_date) VALUES (?, ?, ?, ?, ?, ?, ?);', deckId, front, back, tags ?? null, imageUri ?? null, occlusions ?? null, new Date().toISOString());
  return getCardById(r.lastInsertRowId);
}
export async function updateCard(id: number, front: string, back: string, tags?: string, imageUri?: string, occlusions?: string) {
  await (await getDb()).runAsync('UPDATE cards SET front=?, back=?, tags=?, image_uri=?, occlusions=? WHERE id=?;', front, back, tags ?? null, imageUri ?? null, occlusions ?? null, id);
  return getCardById(id);
}
export async function deleteCard(id: number) { await (await getDb()).runAsync('DELETE FROM cards WHERE id=?;', id); }


export async function bulkMoveCards(cardIds: number[], targetDeckId: number) {
  if (cardIds.length === 0) return;
  const db = await getDb();
  const placeholders = cardIds.map(() => '?').join(',');
  await db.runAsync(`UPDATE cards SET deck_id = ? WHERE id IN (${placeholders});`, targetDeckId, ...cardIds);
}

export async function bulkAddTag(cardIds: number[], tag: string) {
  if (cardIds.length === 0) return;
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; tags: string | null }>(
    `SELECT id, tags FROM cards WHERE id IN (${cardIds.map(() => '?').join(',')});`,
    ...cardIds,
  );
  for (const row of rows) {
    const parts = (row.tags ?? '').split(';').map((x) => x.trim()).filter(Boolean);
    if (!parts.includes(tag)) parts.push(tag);
    await db.runAsync('UPDATE cards SET tags = ? WHERE id = ?;', parts.join(';'), row.id);
  }
}

export async function bulkDeleteCards(cardIds: number[]) {
  if (cardIds.length === 0) return;
  const db = await getDb();
  await db.runAsync(`DELETE FROM cards WHERE id IN (${cardIds.map(() => '?').join(',')});`, ...cardIds);
}

export async function importCardsFromCsv(csv: string) {
  const rows = parseCardsCsv(csv);
  const db = await getDb();
  const decks = await getDecks();
  const deckMap = new Map(decks.map((d) => [d.name.trim().toLowerCase(), d.id]));

  let imported = 0;
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const key = row.deck.trim().toLowerCase();
      let deckId = deckMap.get(key);
      if (!deckId) {
        const r = await db.runAsync('INSERT INTO decks (name, description) VALUES (?, ?);', row.deck.trim(), 'CSV 导入');
        deckId = r.lastInsertRowId;
        deckMap.set(key, deckId);
      }
      await db.runAsync('INSERT INTO cards (deck_id, front, back, tags, image_uri, occlusions, due_date) VALUES (?, ?, ?, ?, ?, ?, ?);', deckId, row.front, row.back, row.tags || null, null, null, new Date().toISOString());
      imported += 1;
    }
  });
  return imported;
}

export async function reviewCard(cardId: number, rating: number, reviewedAt: Date = new Date(), durationSeconds = 30) {
  const db = await getDb();
  const card = await getCardById(cardId);
  if (!card) throw new Error(`card not found: ${cardId}`);

  const next = calculateSm2({ repetition: card.repetition, intervalDays: card.interval_days, easeFactor: card.ease_factor }, rating, reviewedAt);
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO reviews (card_id, reviewed_at, rating, duration_seconds) VALUES (?, ?, ?, ?);', cardId, reviewedAt.toISOString(), rating, Math.max(1, Math.round(durationSeconds)));
    await db.runAsync('UPDATE cards SET repetition=?, interval_days=?, ease_factor=?, due_date=? WHERE id=?;', next.repetition, next.intervalDays, next.easeFactor, next.dueDate, cardId);
  });
  return getCardById(cardId);
}

export async function getTodayDueCount(now: Date = new Date()) {
  return (await getDb()).getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cards WHERE due_date <= ?;', now.toISOString()).then((r) => r?.count ?? 0);
}
export async function getDecksDueToday(now: Date = new Date()) {
  return (await getDb()).getAllAsync<{ id: number; name: string; due_count: number }>(
    `SELECT d.id, d.name, COUNT(c.id) as due_count
     FROM decks d
     LEFT JOIN cards c ON c.deck_id = d.id AND c.due_date <= ?
     GROUP BY d.id, d.name
     ORDER BY d.id ASC;`,
    now.toISOString(),
  );
}
export async function getLapsesCount() {
  return (await getDb()).getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM reviews WHERE rating = 1;').then((r) => r?.count ?? 0);
}
export async function getTodayCompletedCount(now: Date = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return (await getDb()).getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM reviews WHERE substr(reviewed_at, 1, 10) = ?;', date).then((r) => r?.count ?? 0);
}
export async function getReviewStreakDays(now: Date = new Date()) {
  const rows = await (await getDb()).getAllAsync<{ day: string }>('SELECT DISTINCT substr(reviewed_at, 1, 10) as day FROM reviews ORDER BY day DESC;');
  const reviewedDays = new Set(rows.map((r) => r.day));
  let streak = 0;
  const cursor = new Date(now);
  while (true) {
    const day = cursor.toISOString().slice(0, 10);
    if (!reviewedDays.has(day)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
export async function getDeckMastery7d(now: Date = new Date()) {
  const since = new Date(now);
  since.setDate(since.getDate() - 6);
  const rows = await (await getDb()).getAllAsync<DeckMastery & { accuracy: number }>(
    `SELECT d.id as deck_id, d.name as deck_name,
      SUM(CASE WHEN r.rating >= 3 THEN 1 ELSE 0 END) as correct,
      COUNT(*) as total,
      ROUND(100.0 * SUM(CASE WHEN r.rating >= 3 THEN 1 ELSE 0 END) / COUNT(*), 1) as accuracy
     FROM reviews r JOIN cards c ON c.id = r.card_id JOIN decks d ON d.id = c.deck_id
     WHERE r.reviewed_at >= ? GROUP BY d.id, d.name ORDER BY accuracy DESC, total DESC;`,
    since.toISOString(),
  );
  return rows.map((row) => ({ ...row, accuracy: Number(row.accuracy) }));
}

export async function getAverageSecondsPerCard7d(now: Date = new Date()) {
  const since = new Date(now);
  since.setDate(since.getDate() - 6);
  const row = await (await getDb()).getFirstAsync<{ avg: number }>(
    'SELECT AVG(duration_seconds) as avg FROM reviews WHERE reviewed_at >= ?;',
    since.toISOString(),
  );
  return row?.avg ? Number(row.avg) : 30;
}

export async function getNotificationDigest(now: Date = new Date()): Promise<NotificationDigest> {
  const dueCount = await getTodayDueCount(now);
  const avgSec = await getAverageSecondsPerCard7d(now);
  const estimatedMinutes = Math.max(1, Math.round((dueCount * avgSec) / 60));
  const completedToday = dueCount === 0;
  return { dueCount, estimatedMinutes, completedToday };
}

export async function getStatsSummary(now: Date = new Date()): Promise<StatsSummary> {
  const [dueCount, lapsesCount, todayCompleted, streakDays, masteryByDeck] = await Promise.all([
    getTodayDueCount(now), getLapsesCount(), getTodayCompletedCount(now), getReviewStreakDays(now), getDeckMastery7d(now),
  ]);
  return { dueCount, lapsesCount, todayCompleted, streakDays, masteryByDeck };
}

export async function getReviewsByCardId(cardId: number) {
  return (await getDb()).getAllAsync<Review>('SELECT * FROM reviews WHERE card_id = ? ORDER BY reviewed_at DESC;', cardId);
}
export async function createReview(cardId: number, rating: number) {
  const db = await getDb();
  const r = await db.runAsync('INSERT INTO reviews (card_id, rating, duration_seconds) VALUES (?, ?, ?);', cardId, rating, 30);
  return db.getFirstAsync<Review>('SELECT * FROM reviews WHERE id = ?;', r.lastInsertRowId);
}
export async function deleteReview(id: number) { await (await getDb()).runAsync('DELETE FROM reviews WHERE id=?;', id); }
