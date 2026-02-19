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
export type DeckMastery = { deck_id: number; deck_name: string; correct: number; total: number; accuracy: number };
export type StatsSummary = {
  dueCount: number;
  lapsesCount: number;
  todayCompleted: number;
  streakDays: number;
  masteryByDeck: DeckMastery[];
};

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

const state: {
  initialized: boolean;
  schemaVersion: number;
  decks: Deck[];
  cards: Card[];
  reviews: Review[];
} = { initialized: false, schemaVersion: CURRENT_SCHEMA_VERSION, decks: [], cards: [], reviews: [] };

export function __resetInMemoryDbForTests() {
  state.initialized = false;
  state.schemaVersion = CURRENT_SCHEMA_VERSION;
  state.decks = [];
  state.cards = [];
  state.reviews = [];

}


function withLapseCount(card: Card): Card {
  const lapse_count = state.reviews.filter((r) => r.card_id === card.id && r.rating === 1).length;
  return { ...card, lapse_count };
}

const medicalSeedCards: Array<{
  front: string;
  back: string;
  image_uri?: string;
  occlusions?: string;
}> = [
  {
    front: '哈迪-温伯格定律（Hardy-Weinberg）公式',
    back: '在理想群体中，等位基因频率和基因型频率代代保持不变。\n\n设等位基因频率 p（显性A）和 q（隐性a），则：\n%%p + q = 1%%\n%%p^2 + 2pq + q^2 = 1%%\n\n其中 %%p^2%% = AA频率，%%2pq%% = Aa频率，%%q^2%% = aa频率。\n\n五个前提条件：群体足够大、随机交配、无突变、无选择、无迁移。',
  },
  {
    front: 'PD-L1 在肿瘤免疫逃逸中的核心机制',
    back: 'PD-L1（程序性死亡配体1）是肿瘤细胞表面高表达的免疫检查点分子。\n\n核心机制：\n1. 肿瘤细胞上调 PD-L1 表达\n2. PD-L1 与 T 细胞表面的 PD-1 受体结合\n3. 传递抑制信号，导致 T 细胞耗竭（exhaustion）\n4. T 细胞增殖受阻、细胞因子分泌减少、杀伤功能丧失\n\n临床应用：抗 PD-1/PD-L1 单抗（如 pembrolizumab、nivolumab）可阻断该通路，恢复 T 细胞抗肿瘤活性。',
  },
  {
    front: '人体腕骨的八块骨头名称及口诀',
    back: '腕骨共 8 块，分近侧列和远侧列各 4 块：\n\n近侧列（桡→尺）：舟骨、月骨、三角骨、豌豆骨\n远侧列（桡→尺）：大多角骨、小多角骨、头状骨、钩骨\n\n记忆口诀：「舟月三角豌豆大小头状钩」\n\n助记：舟（船）月（亮）三（角）碗（豌）豆，大小头（状）钩（子）。',
  },
  {
    front: '【图像遮挡】左手腕骨解剖 — 指出被遮挡的骨骼名称',
    back: '本卡片用于测试图像遮挡功能。\n\n图中标注了三块腕骨的位置：\n- **舟骨**（Scaphoid）：近侧列桡侧，最易骨折的腕骨\n- **月骨**（Lunate）：近侧列中央，脱位最常见\n- **头状骨**（Capitate）：远侧列中央，腕骨中最大的一块\n\n复习时系统会随机遮挡其中一块，请根据位置判断骨骼名称。',
    image_uri: 'https://upload.wikimedia.org/wikipedia/commons/4/48/Gray219.png',
    occlusions: JSON.stringify([
      { x: 0.10, y: 0.55, width: 0.20, height: 0.15, label: '舟骨' },
      { x: 0.35, y: 0.48, width: 0.18, height: 0.15, label: '月骨' },
      { x: 0.35, y: 0.68, width: 0.20, height: 0.16, label: '头状骨' },
    ]),
  },
];

function ensureInit() {
  if (state.initialized) return;
  const now = new Date().toISOString();
  state.decks = seedDecks.map((d, i) => ({ id: i + 1, name: d.name, description: d.description, created_at: now }));
  state.cards = seedCards.map((c, i) => ({
    id: i + 1,
    deck_id: c.deck + 1,
    front: c.front,
    back: c.back,
    tags: null,
    image_uri: null,
    occlusions: null,
    repetition: 0,
    interval_days: 0,
    ease_factor: 2.5,
    due_date: now,
    created_at: now,
  }));
  state.initialized = true;
}

export async function seedInitialCards() {
  ensureInit();
  if (state.cards.length > 0) return;

  const now = new Date().toISOString();
  const deckId = Math.max(0, ...state.decks.map((d) => d.id)) + 1;
  state.decks.push({ id: deckId, name: '医学/生物学', description: '医学与生物学核心考点复习卡', created_at: now });

  let nextCardId = Math.max(0, ...state.cards.map((c) => c.id)) + 1;
  for (const card of medicalSeedCards) {
    state.cards.push({
      id: nextCardId++,
      deck_id: deckId,
      front: card.front,
      back: card.back,
      tags: null,
      image_uri: card.image_uri ?? null,
      occlusions: card.occlusions ?? null,
      repetition: 0,
      interval_days: 0,
      ease_factor: 2.5,
      due_date: now,
      created_at: now,
    });
  }
}

export async function getSchemaVersion() {
  ensureInit();
  return state.schemaVersion;
}

export async function initializeDatabase() {
  ensureInit();
  await seedInitialCards();
}

export async function clearAllData() {
  ensureInit();
  state.decks = [];
  state.cards = [];
  state.reviews = [];

}

export async function exportAllData(): Promise<ExportPayload> {
  ensureInit();
  return {
    schemaVersion: state.schemaVersion,
    exportedAt: new Date().toISOString(),
    decks: [...state.decks],
    cards: [...state.cards],
    reviews: [...state.reviews],
  };
}

export async function importAllData(payload: ExportPayload, mode: 'merge' | 'replace') {
  ensureInit();
  if (mode === 'replace') {
    state.decks = [];
    state.cards = [];
    state.reviews = [];

  }

  for (const d of payload.decks) if (!state.decks.find((x) => x.id === d.id)) state.decks.push(d);
  for (const c of payload.cards) if (!state.cards.find((x) => x.id === c.id)) state.cards.push(c);
  for (const r of payload.reviews) if (!state.reviews.find((x) => x.id === r.id)) state.reviews.push(r);

  state.schemaVersion = Math.max(CURRENT_SCHEMA_VERSION, payload.schemaVersion ?? CURRENT_SCHEMA_VERSION);
}

export async function getDecks() {
  ensureInit();
  return state.decks;
}
export async function getDeckById(id: number) {
  ensureInit();
  return state.decks.find((d) => d.id === id) ?? null;
}
export async function createDeck(name: string, description?: string) {
  ensureInit();
  const deck: Deck = {
    id: Math.max(0, ...state.decks.map((d) => d.id)) + 1,
    name,
    description: description ?? null,
    created_at: new Date().toISOString(),
  };
  state.decks.push(deck);
  return deck;
}
export async function updateDeck(id: number, name: string, description?: string) {
  ensureInit();
  const d = state.decks.find((x) => x.id === id);
  if (!d) return null;
  d.name = name;
  d.description = description ?? null;
  return d;
}
export async function deleteDeck(id: number) {
  ensureInit();
  state.decks = state.decks.filter((d) => d.id !== id);
  state.cards = state.cards.filter((c) => c.deck_id !== id);
}

export async function getCardsByDeckId(deckId: number) {
  ensureInit();
  return state.cards.filter((c) => c.deck_id === deckId).sort((a, b) => b.id - a.id).map(withLapseCount);
}
export async function getTodayDueCardsByDeckId(deckId: number, now: Date = new Date()) {
  ensureInit();
  return state.cards
    .filter((c) => c.deck_id === deckId && c.due_date <= now.toISOString())
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id);
}
export async function getCardById(id: number) {
  ensureInit();
  const c = state.cards.find((c) => c.id === id);
  return c ? withLapseCount(c) : null;
}
export async function createCard(deckId: number, front: string, back: string, tags?: string, imageUri?: string, occlusions?: string) {
  ensureInit();
  const card: Card = {
    id: Math.max(0, ...state.cards.map((c) => c.id)) + 1,
    deck_id: deckId,
    front,
    back,
    tags: tags ?? null,
    image_uri: imageUri ?? null,
    occlusions: occlusions ?? null,
    repetition: 0,
    interval_days: 0,
    ease_factor: 2.5,
    due_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  state.cards.push(card);
  return card;
}
export async function updateCard(id: number, front: string, back: string, tags?: string, imageUri?: string, occlusions?: string) {
  ensureInit();
  const card = state.cards.find((c) => c.id === id);
  if (!card) return null;
  card.front = front;
  card.back = back;
  card.tags = tags ?? null;
  card.image_uri = imageUri ?? null;
  card.occlusions = occlusions ?? null;
  return card;
}
export async function deleteCard(id: number) {
  ensureInit();
  state.cards = state.cards.filter((c) => c.id !== id);
  state.reviews = state.reviews.filter((r) => r.card_id !== id);
}


export async function bulkMoveCards(cardIds: number[], targetDeckId: number) {
  ensureInit();
  const set = new Set(cardIds);
  state.cards.forEach((c) => {
    if (set.has(c.id)) c.deck_id = targetDeckId;
  });
}

export async function bulkAddTag(cardIds: number[], tag: string) {
  ensureInit();
  const set = new Set(cardIds);
  state.cards.forEach((c) => {
    if (!set.has(c.id)) return;
    const parts = (c.tags ?? '').split(';').map((x) => x.trim()).filter(Boolean);
    if (!parts.includes(tag)) parts.push(tag);
    c.tags = parts.join(';');
  });
}

export async function bulkDeleteCards(cardIds: number[]) {
  ensureInit();
  const set = new Set(cardIds);
  state.cards = state.cards.filter((c) => !set.has(c.id));
  state.reviews = state.reviews.filter((r) => !set.has(r.card_id));
}

export async function importCardsFromCsv(csv: string) {
  ensureInit();
  const rows = parseCardsCsv(csv);
  let imported = 0;
  for (const row of rows) {
    const key = row.deck.trim().toLowerCase();
    let deck = state.decks.find((d) => d.name.trim().toLowerCase() === key);
    if (!deck) deck = await createDeck(row.deck.trim(), 'CSV 导入');
    await createCard(deck.id, row.front, row.back, row.tags || undefined);
    imported += 1;
  }
  return imported;
}

export async function reviewCard(cardId: number, rating: number, reviewedAt: Date = new Date(), durationSeconds = 30) {
  ensureInit();
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`card not found: ${cardId}`);
  const next = calculateSm2(
    { repetition: card.repetition, intervalDays: card.interval_days, easeFactor: card.ease_factor },
    rating,
    reviewedAt,
  );
  card.repetition = next.repetition;
  card.interval_days = next.intervalDays;
  card.ease_factor = next.easeFactor;
  card.due_date = next.dueDate;
  state.reviews.push({
    id: Math.max(0, ...state.reviews.map((r) => r.id)) + 1,
    card_id: cardId,
    reviewed_at: reviewedAt.toISOString(),
    rating,
    duration_seconds: Math.max(1, Math.round(durationSeconds)),
  });
  return card;
}

export async function getTodayDueCount(now: Date = new Date()) {
  ensureInit();
  return state.cards.filter((c) => c.due_date <= now.toISOString()).length;
}
export async function getDecksDueToday(now: Date = new Date()) {
  ensureInit();
  const nowIso = now.toISOString();
  return state.decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    due_count: state.cards.filter((c) => c.deck_id === deck.id && c.due_date <= nowIso).length,
  }));
}
export async function getLapsesCount() {
  ensureInit();
  return state.reviews.filter((r) => r.rating === 1).length;
}
export async function getTodayCompletedCount(now: Date = new Date()) {
  ensureInit();
  const day = now.toISOString().slice(0, 10);
  return state.reviews.filter((r) => r.reviewed_at.slice(0, 10) === day).length;
}
export async function getReviewStreakDays(now: Date = new Date()) {
  ensureInit();
  const reviewed = new Set(state.reviews.map((r) => r.reviewed_at.slice(0, 10)));
  let streak = 0;
  const cursor = new Date(now);
  while (true) {
    const day = cursor.toISOString().slice(0, 10);
    if (!reviewed.has(day)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
export async function getDeckMastery7d(now: Date = new Date()) {
  ensureInit();
  const since = new Date(now);
  since.setDate(since.getDate() - 6);
  const byDeck = new Map<number, { correct: number; total: number }>();
  for (const review of state.reviews) {
    if (new Date(review.reviewed_at) < since) continue;
    const card = state.cards.find((c) => c.id === review.card_id);
    if (!card) continue;
    const cur = byDeck.get(card.deck_id) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (review.rating >= 3) cur.correct += 1;
    byDeck.set(card.deck_id, cur);
  }
  return [...byDeck.entries()]
    .map(([deck_id, agg]) => {
      const deck = state.decks.find((d) => d.id === deck_id);
      const accuracy = agg.total > 0 ? Number(((agg.correct / agg.total) * 100).toFixed(1)) : 0;
      return { deck_id, deck_name: deck?.name ?? `Deck ${deck_id}`, correct: agg.correct, total: agg.total, accuracy };
    })
    .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total);
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  ensureInit();
  const raw = (globalThis as any).__reminderSettings as ReminderSettings | undefined;
  return raw ?? { enabled: false, hour: 21, minute: 30, onCompleted: 'skip' };
}

export async function saveReminderSettings(settings: ReminderSettings) {
  (globalThis as any).__reminderSettings = settings;
}

export async function getAverageSecondsPerCard7d(now: Date = new Date()) {
  ensureInit();
  const since = new Date(now);
  since.setDate(since.getDate() - 6);
  const rows = state.reviews.filter((r) => new Date(r.reviewed_at) >= since);
  if (rows.length === 0) return 30;
  return rows.reduce((sum, r) => sum + (r.duration_seconds || 30), 0) / rows.length;
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
    getTodayDueCount(now),
    getLapsesCount(),
    getTodayCompletedCount(now),
    getReviewStreakDays(now),
    getDeckMastery7d(now),
  ]);
  return { dueCount, lapsesCount, todayCompleted, streakDays, masteryByDeck };
}

export async function getReviewsByCardId(cardId: number) {
  ensureInit();
  return state.reviews
    .filter((r) => r.card_id === cardId)
    .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at));
}
export async function createReview(cardId: number, rating: number) {
  ensureInit();
  const r: Review = {
    id: Math.max(0, ...state.reviews.map((x) => x.id)) + 1,
    card_id: cardId,
    rating,
    reviewed_at: new Date().toISOString(),
    duration_seconds: 30,
  };
  state.reviews.push(r);
  return r;
}
export async function deleteReview(id: number) {
  ensureInit();
  state.reviews = state.reviews.filter((r) => r.id !== id);
}
