export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LABELS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function formatTime(t: string) {
  // "HH:MM:SS" or "HH:MM"
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const min = m ?? "00";
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = ((hour + 11) % 12) + 1;
  return `${h12}:${min} ${suffix}`;
}

export function statusLabel(s: string, delay: number) {
  if (s === "cancelled") return "Cancelled";
  if (s === "delayed") return delay ? `Delayed ${delay} min` : "Delayed";
  return "On time";
}

export function statusColor(s: string) {
  if (s === "cancelled") return "bg-destructive/10 text-destructive border-destructive/20";
  if (s === "delayed") return "bg-warning/15 text-warning-foreground border-warning/30";
  return "bg-success/15 text-success border-success/30";
}
