/**
 * Cart lines and order items returned by the API only carry ids and prices, but the
 * UI needs `isVeg` / `image` / `description` to render dish rows. Menus are already
 * being fetched while browsing, so we keep a lightweight in-memory index of every
 * menu item we have seen and use it to enrich those rows.
 */

const itemIndex = new Map();

export function rememberMenuItems(kitchenId, items = []) {
  items.forEach((item) => {
    if (!item?.id) return;
    itemIndex.set(item.id, { ...item, restaurantId: item.restaurantId || kitchenId });
  });
}

export function rememberMenu(kitchenId, categories = []) {
  categories.forEach((category) => rememberMenuItems(kitchenId, category.items || []));
}

export function getRememberedMenuItem(menuItemId) {
  return itemIndex.get(menuItemId) || null;
}

export function enrichMenuItem(menuItemId, overrides = {}) {
  const remembered = itemIndex.get(menuItemId) || {};
  return { ...remembered, ...overrides };
}

export function clearMenuCache() {
  itemIndex.clear();
}
