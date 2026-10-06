const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (value) => String(value).padStart(2, "0");

export function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "20 June 2026" */
export function formatDateLong(value) {
  const date = toDate(value);
  if (!date) return "";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "1 May - 8 May 2026" (same year) / "30 December 2025 - 2 January 2026" */
export function formatDateRange(startValue, endValue) {
  const start = toDate(startValue);
  const end = toDate(endValue);
  if (!start && !end) return "";
  if (!start) return formatDateLong(end);
  if (!end) return formatDateLong(start);

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} ${MONTHS[start.getMonth()]} - ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  }

  return `${formatDateLong(start)} - ${formatDateLong(end)}`;
}

/** "5:09 PM" */
export function formatTime12(value) {
  const date = toDate(value);
  if (!date) return "";
  const hours24 = date.getHours();
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${pad(date.getMinutes())} ${suffix}`;
}

/** "17:09" */
export function formatTime24(value) {
  const date = toDate(value);
  if (!date) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "13 June '26, 17:09" */
export function formatDateTimeShort(value) {
  const date = toDate(value);
  if (!date) return "";
  const year = String(date.getFullYear()).slice(-2);
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} '${year}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "13 June 2026" for grouping day headers */
export function formatDayHeading(value) {
  const date = toDate(value);
  if (!date) return "";
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function combineDateAndTime(date, time) {
  const base = toDate(date);
  if (!base || !time) return null;

  const [hours, minutes] = String(time).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  base.setHours(hours, minutes, 0, 0);
  return base.toISOString();
}

export function addMinutesToTime(time, minutes) {
  if (!time) return "";
  const [hours, mins] = String(time).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return "";

  const total = hours * 60 + mins + minutes;
  const nextHours = Math.floor(total / 60) % 24;
  const nextMinutes = total % 60;
  return `${pad(nextHours)}:${pad(nextMinutes)}`;
}

export function formatTime12FromClock(time) {
  if (!time) return "";
  const [hours, minutes] = String(time).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
  const suffix = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12}:${pad(minutes)} ${suffix}`;
}

export function isValidIso(value) {
  return Boolean(toDate(value));
}
