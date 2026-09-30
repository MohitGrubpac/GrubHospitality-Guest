const DEFAULT_API_BASE_URL = "https://api-kitchen.grubpacapp.tech/api/v1";

const trimTrailingSlash = (value) => String(value).replace(/\/+$/, "");

export const API_BASE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
);

export const ORGANIZATION_ID = process.env.NEXT_PUBLIC_ORGANIZATION_ID || "";

export const API_TIMEOUT_MS = 20000;
