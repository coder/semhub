/**
 * Get n random items from an array
 * @param arr The array to get items from
 * @param count The number of items to get
 * @returns Array of n random items
 */
export function getRandomItems<T>(arr: readonly T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
