export type Sm2CardState = {
  repetition: number;
  intervalDays: number;
  easeFactor: number;
};

export type Sm2Result = Sm2CardState & {
  dueDate: string;
};

export function calculateSm2(
  current: Sm2CardState,
  quality: number,
  now: Date = new Date(),
): Sm2Result {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new Error('quality must be an integer between 0 and 5');
  }

  let repetition = current.repetition;
  let intervalDays = current.intervalDays;

  const qualityDiff = 5 - quality;
  const nextEaseFactor = Math.max(
    1.3,
    current.easeFactor + (0.1 - qualityDiff * (0.08 + qualityDiff * 0.02)),
  );

  if (quality < 3) {
    repetition = 0;
    intervalDays = 1;
  } else {
    repetition += 1;
    if (repetition === 1) {
      intervalDays = 1;
    } else if (repetition === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.max(1, Math.round(current.intervalDays * nextEaseFactor));
    }
  }

  const due = new Date(now);
  due.setDate(due.getDate() + intervalDays);

  return {
    repetition,
    intervalDays,
    easeFactor: Number(nextEaseFactor.toFixed(4)),
    dueDate: due.toISOString(),
  };
}
