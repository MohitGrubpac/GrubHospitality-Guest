import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
export const API =
  env.match(/NEXT_PUBLIC_API_BASE_URL\s*=\s*"([^"]+)"/)?.[1] ||
  "https://api-kitchen.grubpacapp.tech/api/v1";
