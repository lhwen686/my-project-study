import { beforeEach, describe, expect, it } from 'vitest';

import { createReviewFlow, flipCurrent, gradeCurrent } from './review-flow';
import {
  __resetInMemoryDbForTests,
  getCardById,
  getLapsesCount,
  getTodayDueCardsByDeckId,
  initializeDatabase,
  reviewCard,
} from './sqlite.web';

describe('Review flow integration', () => {
  beforeEach(async () => {
    __resetInMemoryDbForTests();
    await initializeDatabase();
  });

  it('simulate flip + choose 会, card due moves to future', async () => {
    const dueCards = await getTodayDueCardsByDeckId(1);
    const first = dueCards[0];
    const beforeDue = first.due_date;

    let flow = createReviewFlow(dueCards);
    flow = flipCurrent(flow);
    expect(flow.showBack).toBe(true);

    flow = await gradeCurrent(flow, 5, reviewCard);
    expect(flow.index).toBe(1);
    expect(flow.showBack).toBe(false);

    const updated = await getCardById(first.id);
    expect(updated!.due_date > beforeDue).toBe(true);
  });

  it('simulate flip + choose 不会, lapses increases and interval resets', async () => {
    const dueCards = await getTodayDueCardsByDeckId(1);
    const first = dueCards[0];
    const lapsesBefore = await getLapsesCount();

    let flow = createReviewFlow(dueCards);
    flow = flipCurrent(flow);
    flow = await gradeCurrent(flow, 1, reviewCard);

    const lapsesAfter = await getLapsesCount();
    expect(lapsesAfter).toBe(lapsesBefore + 1);

    const updated = await getCardById(first.id);
    expect(updated!.repetition).toBe(0);
    expect(updated!.interval_days).toBe(1);
  });
});
