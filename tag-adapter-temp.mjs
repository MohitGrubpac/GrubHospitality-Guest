import { readFileSync, writeFileSync } from "fs";

let src = readFileSync("src/lib/adapters/catalogAdapter.js", "utf8");
src = src.replace('@/lib/money', './ca-stub1.mjs');
writeFileSync("ca-temp.mjs", src);
writeFileSync("ca-stub1.mjs", "export const fromMinor = (v) => v / 100;\n");

const { toMenuItem } = await import("./ca-temp.mjs");

const results = [];
const rec = (n, p, d = "") => { results.push(p); console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? ` :: ${d}` : ""}`); };

const withObjTags = toMenuItem({ id: "m1", name: "Paneer Tikka", priceMinor: 32000, tags: [{ name: "spicy" }, "veg", null, { label: "grill" }, 42] });
rec("object/string/null/number tags normalized to strings",
  JSON.stringify(withObjTags.tags) === JSON.stringify(["spicy", "veg", "grill", "42"]),
  JSON.stringify(withObjTags.tags));

const noTags = toMenuItem({ id: "m2", name: "Dal", priceMinor: 10000, tags: undefined });
rec("missing tags -> []", Array.isArray(noTags.tags) && noTags.tags.length === 0);

const q = "spic";
const matches = withObjTags.tags.some((tag) => String(tag ?? "").toLowerCase().includes(q));
rec("useDishFilters-style query matches object-derived tag", matches === true);

const badTag = { foo: 1 };
rec("unrecognized object tag -> empty string (filtered out)",
  toMenuItem({ id: "m3", name: "X", priceMinor: 0, tags: [badTag] }).tags.length === 0);

const ICON = "https://grubpac-kitchen.s3.ap-south-1.amazonaws.com/tag-icons/spicy.png";
const withIcon = toMenuItem({ id: "m4", name: "Chicken 65", priceMinor: 36000, tags: [{ name: "Spicy", icon: ICON }] });
rec("tagList keeps name + icon",
  JSON.stringify(withIcon.tagList) === JSON.stringify([{ name: "Spicy", icon: ICON }]),
  JSON.stringify(withIcon.tagList));
rec("tags stays plain strings for filters/search",
  JSON.stringify(withIcon.tags) === JSON.stringify(["Spicy"]),
  JSON.stringify(withIcon.tags));
rec("legacy string tags get empty icon in tagList",
  toMenuItem({ id: "m5", name: "Dal", priceMinor: 100, tags: ["veg"] }).tagList[0].icon === "");
rec("rating passes through (number)",
  toMenuItem({ id: "m6", name: "Chai", priceMinor: 100, rating: 3.5 }).rating === 3.5);
rec("rating null stays null",
  toMenuItem({ id: "m7", name: "Chai", priceMinor: 100, rating: null }).rating === null);

const failed = results.filter((p) => !p).length;
console.log(`\n======== ${results.length - failed}/${results.length} passed ========`);
process.exit(failed ? 1 : 0);
