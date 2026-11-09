export function sixMonthsAgo(now = new Date()) {
  const cutoff = new Date(now);
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return cutoff;
}

export function hasRecentCodePush(pushedAt, now = new Date()) {
  if (typeof pushedAt !== "string" || !pushedAt.trim()) return false;
  const timestamp = Date.parse(pushedAt);
  return Number.isFinite(timestamp) && timestamp >= sixMonthsAgo(now).getTime() && timestamp <= now.getTime();
}
