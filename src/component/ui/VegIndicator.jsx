"use client";

/**
 * The cart and order APIs return no `isVeg` flag, so `null`/`undefined` means
 * "unknown" and renders nothing rather than defaulting to vegetarian.
 */
export default function VegIndicator({ isVeg, size = 16, className = "" }) {
  if (isVeg !== true && isVeg !== false) return null;

  const box = size === 14 ? "w-[14px] h-[14px] border-2" : "w-[16px] h-[16px] border-2";
  const dot = size === 14 ? "w-[6px] h-[6px]" : "w-[8px] h-[8px]";

  if (isVeg) {
    return (
      <div
        className={`${box} border-green-600 rounded-sm flex items-center justify-center shrink-0 ${className}`}
      >
        <div className={`${dot} bg-green-600 rounded-full`} />
      </div>
    );
  }

  return (
    <div
      className={`${box} border-red-600 rounded-sm flex items-center justify-center shrink-0 ${className}`}
    >
      <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-red-600" />
    </div>
  );
}
