/**
 * The API returns every monetary amount as integer minor units (INR paise).
 * These helpers are the only place that conversion happens.
 */

export function fromMinor(minor) {
  const value = Number(minor);
  return Number.isFinite(value) ? value / 100 : 0;
}

export function toMinor(major) {
  const value = Number(major);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function formatMinor(minor, currency = "INR") {
  const amount = fromMinor(minor);

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}
