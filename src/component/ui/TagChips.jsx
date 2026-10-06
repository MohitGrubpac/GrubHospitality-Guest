"use client";

import Image from "next/image";

/**
 * Tag badges from the menu API. Each tag is { name, icon } where `icon` is a badge
 * image URL on the kitchen S3 bucket. The design shows these as a row of bare icons
 * under the dish/kitchen name; a text pill is used only when a tag has no icon.
 */
export default function TagChips({ tags = [], max, size = "md" }) {
  const list = (Array.isArray(tags) ? tags : []).filter((tag) => tag && (tag.name || tag.icon));
  const shown = max ? list.slice(0, max) : list;
  if (!shown.length) return null;

  const dim = size === "sm" ? 16 : 20;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {shown.map((tag, index) =>
        tag.icon ? (
          <Image
            key={`${tag.name}-${index}`}
            src={tag.icon}
            alt={tag.name}
            title={tag.name}
            width={dim}
            height={dim}
            className={size === "sm" ? "w-4 h-4 object-contain" : "w-5 h-5 object-contain"}
          />
        ) : (
          <span
            key={`${tag.name}-${index}`}
            title={tag.name}
            className={`text-[#6b7971] font-medium uppercase tracking-wide ${
              size === "sm" ? "text-[9px]" : "text-[10px]"
            }`}
          >
            {tag.name}
          </span>
        ),
      )}
    </div>
  );
}
