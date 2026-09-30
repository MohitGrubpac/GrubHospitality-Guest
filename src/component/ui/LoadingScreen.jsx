"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function LoadingScreen({ onComplete, duration = 2000 }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, duration / 20);

    const timer = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onComplete, duration]);

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
      <div className="relative w-[180px] h-[60px] mb-8">
        <Image
          src="/hyatt_logo.png"
          alt="Hotel"
          fill
          sizes="180px"
          className="object-contain"
          priority
        />
      </div>
      <div className="w-[200px] h-[3px] bg-[#e0e3e1] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#6b21a8] rounded-full transition-all duration-100 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
