"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function HomeSearchBar({
  value,
  onChange,
  placeholder = "Search, Dish, Restaurants etc.",
  onNavigateOnEnter = true,
}) {
  const router = useRouter();

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && onNavigateOnEnter && value && value.trim().length > 0) {
      router.push(`/home/search?q=${encodeURIComponent(value.trim())}`);
    }
  };

  return (
    <div className="relative w-full shrink-0">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        className="w-full h-12 pl-12 pr-4 bg-white border border-[#e0e3e1] rounded-xl text-base text-[var(--color-neutral-primary,#03130a)] placeholder:text-[#a4aca7] outline-none focus:border-[#fe480b] transition-all shadow-xs"
      />
      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <Image
          src="/home/search.svg"
          alt="Search"
          width={20}
          height={20}
          className="w-5 h-5 object-contain"
        />
      </div>
    </div>
  );
}
