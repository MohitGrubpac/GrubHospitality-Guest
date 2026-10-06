"use client";

import Image from "next/image";

/**
 * Five-star display row: filled stars up to `value`, outlined after it.
 * Used by the feedback summary, the stay order cards and the history cards.
 */
export default function StarRating({ value = 0, size = 16, className = "" }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Image
          key={star}
          src={star <= value ? "/profile/star_filled.svg" : "/profile/star_outline.svg"}
          alt={`Star ${star}`}
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className="object-contain"
        />
      ))}
    </div>
  );
}
