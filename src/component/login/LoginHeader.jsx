"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const slides = [
  {
    id: 1,
    title: "Discover Dining",
    subtitle: "Browse hotel menus and find your favourites.",
    image: "/loginCrousel/Login_Crousel1.jpg",
  },
  {
    id: 2,
    title: "Order with Ease",
    subtitle: "Order now or schedule for later.",
    image: "/loginCrousel/Login_Crousel2.jpg",
  },
  {
    id: 3,
    title: "Fresh to Your Room",
    subtitle: "Track your order and enjoy room delivery.",
    image: "/loginCrousel/Login_Crousel3.jpg",
  },
];

export default function LoginHeader() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 40) {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    } else if (distance < -40) {
      setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <header
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full h-[300px] sm:h-[320px] overflow-hidden bg-slate-950 flex-shrink-0 select-none cursor-grab active:cursor-grabbing"
    >
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
            index === currentSlide
              ? "opacity-100 z-10 pointer-events-auto"
              : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <Image
            src={slide.image}
            alt={slide.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover object-center brightness-[0.75]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
        </div>
      ))}

      <div className="absolute top-4 left-4 z-20">
        <span
          className="font-medium text-[20px] leading-[120%] tracking-normal"
          style={{
            color: "#FF3333",
            fontFamily: "var(--font-orbitron)",
          }}
        >
          GrubHospitality
        </span>
      </div>

      <div className="absolute bottom-12 left-5 right-5 z-20 text-white">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
          {slides[currentSlide].title}
        </h1>
        <p className="text-sm sm:text-base text-slate-200 font-light italic">
          {slides[currentSlide].subtitle}
        </p>
      </div>

      {/* Carousel Dots */}
      <div className="absolute bottom-12 right-5 z-20 flex items-center gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrentSlide(index)}
            className={`transition-all duration-300 rounded-full cursor-pointer ${
              index === currentSlide
                ? "w-7 h-2.5 bg-[#FF3333]"
                : "w-2.5 h-2.5 bg-white hover:bg-white/80"
            }`}
            aria-label={`Slide ${index + 1}`}
          />
        ))}
      </div>
    </header>
  );
}
