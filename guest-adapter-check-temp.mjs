import { readFileSync, writeFileSync } from "fs";

let src = readFileSync("src/lib/adapters/guestAdapter.js", "utf8");
src = src.replace("@/lib/adapters/shared", "./ga-stub1.mjs").replace("@/lib/adapters/orderAdapter", "./ga-stub2.mjs");
writeFileSync("ga-temp.mjs", src);
writeFileSync("ga-stub1.mjs", 'export const toDisplayDate = (v) => v || "";\nexport const toInitials = () => "X";\n');
writeFileSync("ga-stub2.mjs", "export const toActiveOrder = (o) => o;\n");

const { toGuestUser } = await import("./ga-temp.mjs");

const g = toGuestUser(JSON.parse(readFileSync("guest-me-fixture.json", "utf8")));
console.log("banner title  :", JSON.stringify(g.hotel));
console.log("banner subline:", JSON.stringify(g.location));
console.log("propertyName  :", JSON.stringify(g.hotelName));
console.log("rooms         :", JSON.stringify(g.roomNumbers));

const flat = toGuestUser({ id: "x", name: "A", hotelName: "Hyatt Place", hotel: { name: "Hyatt Hotels" }, roomNumber: "1204" });
console.log("flat title    :", JSON.stringify(flat.hotel), "| flat subline:", JSON.stringify(flat.location));

const bare = toGuestUser({ id: "x", name: "A", stay: { hotelName: "P" }, hotel: { name: "H" } });
console.log("no address    :", JSON.stringify(bare.hotel), "|", JSON.stringify(bare.location));

const noHotelObj = toGuestUser({ id: "x", name: "A", stay: { hotelName: "P", hotelAddress: "DL" } });
console.log("stay-level addr:", JSON.stringify(noHotelObj.location));
