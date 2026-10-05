// Current weekly records take precedence over the verified monthly archive.
export function publishedMealForDate(pack, date) {
  return [...(pack.lunchArchive || []), ...(pack.lunchMenu || [])]
    .findLast(meal => meal.date === date);
}
