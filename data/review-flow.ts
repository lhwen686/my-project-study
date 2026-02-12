import { Card } from './sqlite.web';

export type ReviewFlowState = {
  cards: Card[];
  index: number;
  showBack: boolean;
};

export function createReviewFlow(cards: Card[]): ReviewFlowState {
  return { cards, index: 0, showBack: false };
}

export function flipCurrent(state: ReviewFlowState): ReviewFlowState {
  return { ...state, showBack: true };
}

export async function gradeCurrent(
  state: ReviewFlowState,
  rating: number,
  reviewFn: (cardId: number, rating: number) => Promise<unknown>,
): Promise<ReviewFlowState> {
  const current = state.cards[state.index];
  if (!current) return state;
  await reviewFn(current.id, rating);
  return { ...state, index: state.index + 1, showBack: false };
}
