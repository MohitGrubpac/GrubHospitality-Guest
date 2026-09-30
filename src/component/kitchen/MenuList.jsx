"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import CategoryCard from "./CategoryCard";
import CategoryMenu from "./CategoryMenu";
import MenuItemCard from "./MenuItemCard";

export default function MenuList({
  menuData = [],
  categories = [],
  activeCategory = "",
  onSelectCategory,
  onMenuItemClick,
}) {
  // Expand the first category by default; user toggles are kept per category id.
  const [toggled, setToggled] = useState({});

  const expandedCategories = useMemo(() => {
    const next = {};
    menuData.forEach((category, index) => {
      next[category.id] = toggled[category.id] ?? index === 0;
    });
    return next;
  }, [menuData, toggled]);

  const toggleCategory = (categoryId) => {
    setToggled((previous) => ({
      ...previous,
      [categoryId]: !(previous[categoryId] ?? false),
    }));
  };

  if (menuData.length === 0) {
    return (
      <div className="w-full py-12 text-center text-[14px] text-[var(--gp-color-text-neutral-secondary)]">
        No dishes match your filters.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-[var(--gp-space-xl)]">
      {menuData.map((category, index) => (
        <div
          key={category.id}
          id={`category-${category.id}`}
          className="w-full flex flex-col scroll-mt-[24px]"
        >
          <CategoryCard
            title={category.name}
            description={category.description}
            image={category.image}
            isExpanded={Boolean(expandedCategories[category.id])}
            onToggle={() => toggleCategory(category.id)}
            action={
              index === 0 ? (
                <CategoryMenu
                  categories={categories}
                  activeCategory={activeCategory}
                  onSelectCategory={onSelectCategory}
                />
              ) : null
            }
          />

          {expandedCategories[category.id] && (
            <>
              <div className="w-full flex justify-center px-[16px]">
                <Image
                  src="/kitchen/divider.png"
                  alt="divider"
                  width={380}
                  height={1}
                  className="w-full h-auto"
                />
              </div>

              <div className="w-full flex flex-col">
                {(category.items || []).map((item, itemIndex) => (
                  <div key={item.id} className="w-full flex flex-col">
                    <MenuItemCard
                      item={item}
                      isOutOfStock={item.isOutOfStock}
                      onClick={() => onMenuItemClick?.(item)}
                    />
                    {itemIndex < category.items.length - 1 && (
                      <div className="w-full flex justify-center px-[16px]">
                        <Image
                          src="/kitchen/divider.png"
                          alt="divider"
                          width={380}
                          height={1}
                          className="w-full h-auto"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
