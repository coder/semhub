const units = [
  "year",
  "month",
  "week",
  "day",
  "hour",
  "minute",
  "second",
] as const;

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  style: "long",
});

export function getTimeAgo(date: Date) {
  const diff = date.getTime() - Date.now();

  // Convert diff to seconds
  const diffInSeconds = diff / 1000;

  // Define conversion factors
  const conversions = {
    year: 31536000,
    month: 2628000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  } as const;

  // Find the most appropriate unit
  const unit =
    units.find((unit) => Math.abs(diffInSeconds) >= conversions[unit]) ||
    "second";

  // Calculate the value in the selected unit
  const value = Math.round(diffInSeconds / conversions[unit]);

  return relativeTimeFormatter.format(value, unit);
}

export function formatLocalDateTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
