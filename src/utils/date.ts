export function calculateLookbackDate(lookbackDays: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - lookbackDays);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function isWithinLookback(publishedAt: Date, lookbackDays: number): boolean {
  const threshold = calculateLookbackDate(lookbackDays);
  return publishedAt >= threshold;
}
