import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
// Only honour ACTIVE lines - a commented-out NEXT_PUBLIC_API_BASE_URL must not win.
const activeLine = env
  .split(/\r?\n/)
  .find((line) => /^\s*NEXT_PUBLIC_API_BASE_URL\s*=/.test(line));
export const API =
  activeLine?.match(/"([^"]+)"/)?.[1] ||
  "https://api-kitchen.grubpacapp.tech/api/v1";
