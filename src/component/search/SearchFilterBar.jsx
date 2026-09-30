"use client";

import Image from "next/image";

export default function SearchFilterBar({ onOpenFilter, onOpenSort }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-hide w-full shrink-0">
      {/* Filter  */}
      <button
        type="button"
        onClick={onOpenFilter}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#d2d7d4] rounded-lg text-xs font-bold text-[#6b7971] hover:bg-slate-50 transition-colors shrink-0 cursor-pointer uppercase"
      >
        <Image
          src="/restaurant/funnel.svg"
          alt="Filter"
          width={14}
          height={14}
          className="w-3.5 h-3.5 object-contain"
        />
        <span>FILTER</span>
        <Image
          src="/restaurant/chevron_down.svg"
          alt="Down"
          width={12}
          height={12}
          className="w-3 h-3 object-contain"
        />
      </button>

      {/* Sort By*/}
      <button
        type="button"
        onClick={onOpenSort}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#d2d7d4] rounded-lg text-xs font-bold text-[#6b7971] hover:bg-slate-50 transition-colors shrink-0 cursor-pointer uppercase"
      >
        <Image
          src="/restaurant/sort.svg"
          alt="Sort"
          width={14}
          height={14}
          className="w-3.5 h-3.5 object-contain"
        />
        <span>sort by</span>
        <Image
          src="/restaurant/chevron_down.svg"
          alt="Down"
          width={12}
          height={12}
          className="w-3 h-3 object-contain"
        />
      </button>
    </div>
  );
}
