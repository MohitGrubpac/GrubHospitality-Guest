"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function CategoryMenu({
  categories = [],
  activeCategory = "",
  onSelectCategory,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-[8px] h-[40px] min-w-[56px] px-[12px] bg-white cursor-pointer transition-colors hover:bg-[var(--gp-color-bg-neutral-tertiary)]"
        style={{
          width: "104px",
          borderRadius: "8px",
          borderTop: "1px solid #FF3333",
          borderLeft: "1px solid #FF3333",
          borderRight: "1px solid #FF3333",
          borderBottom: "1px solid #FF3333",
          background: isOpen ? "var(--gp-color-bg-brand-secondary)" : "#FFFFFF",
        }}
      >
        <Image
          src="/kitchen/list.png"
          alt="Menu list"
          width={20}
          height={20}
          className="shrink-0"
        />
        <span
          className="font-medium uppercase"
          style={{
            fontSize: "16px",
            lineHeight: "20px",
            color: "#FF3333",
            textTransform: "uppercase",
          }}
        >
          MENU
        </span>
      </button>

      {/* Categories Popup */}
      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[280px] bg-white rounded-[var(--gp-radius-base)] border border-[var(--gp-color-border-neutral)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] z-20 overflow-hidden">
          {categories.length === 0 ? (
            <p className="px-[var(--gp-padding-l)] py-[var(--gp-padding-l)] text-[14px] text-[var(--gp-color-text-neutral-tertiary)]">
              No categories available
            </p>
          ) : (
            categories.map((cat, index) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onSelectCategory?.(cat.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-[var(--gp-padding-l)] py-[var(--gp-padding-l)] cursor-pointer transition-colors ${
                  activeCategory === cat.id
                    ? "bg-[var(--gp-color-bg-brand-secondary)]"
                    : "bg-white hover:bg-[var(--gp-color-bg-neutral-tertiary)]"
                } ${
                  index < categories.length - 1
                    ? "border-b border-[var(--gp-color-border-neutral)]"
                    : ""
                }`}
              >
                <span
                  className={`text-[16px] font-medium ${
                    activeCategory === cat.id
                      ? "text-[var(--gp-color-brand-primary)]"
                      : "text-[var(--gp-color-text-neutral-primary)]"
                  }`}
                >
                  {cat.name}
                </span>
                <span className="text-[14px] text-[var(--gp-color-text-neutral-tertiary)]">
                  {cat.count}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}