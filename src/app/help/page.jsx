"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import content from "@/data/static-content.json";

export default function HelpPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState(null);

  const { helpCategories = [], faqs = [] } = content;

  const toggleFaq = (id) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  const filteredFaqs = faqs.filter(
    (faq) =>
      !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full min-h-screen bg-[#f8faf9] flex flex-col items-center select-none overflow-hidden font-sans">
      <div className="w-full max-w-[480px] sm:max-w-[768px] bg-[#f7f8fa] min-h-screen shadow-sm flex flex-col overflow-hidden relative pb-8">
        {/* Header Bar */}
        <header className="w-full px-5 py-4 bg-white border-b border-[#eff1f0] flex items-center gap-3 shrink-0 z-40">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <Image
              src="/restaurant/back.svg"
              alt="Back"
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
            />
          </button>
          <h1 className="text-lg font-bold text-[#03130a]">Help</h1>
        </header>

        <main className="flex-1 px-5 pt-4 pb-12 flex flex-col gap-4 overflow-y-auto">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search for Help, Hotel Services"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-white border border-[#e0e3e1] rounded-lg text-base font-medium text-[#03130a] placeholder:text-[#a4aca7] outline-none shadow-2xs"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
              <Image
                src="/home/search.svg"
                alt="Search"
                width={18}
                height={18}
                className="w-4 h-4 object-contain"
              />
            </div>
          </div>

          <div className="w-full bg-white rounded-2xl p-5 shadow-xs border border-[#e0e3e1] flex flex-col gap-3">
            <h2 className="text-[18px] leading-[28px] font-semibold text-[#03130A]">
              Quick Help
            </h2>

            <div className="flex flex-col border-t border-[#eff1f0] pt-1">
              {helpCategories.map((cat, idx) => (
                <div
                  key={cat.id}
                  onClick={() => router.push("/profile/order-history")}
                  className={`flex items-center justify-between py-3 cursor-pointer ${
                    idx !== helpCategories.length - 1 ? "border-b border-[#eff1f0]" : ""
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-[16px] leading-[24px] font-semibold text-[#37493F]">
                      {cat.title}
                    </h3>
                    <p className="text-[14px] leading-[20px] font-normal italic text-[#6B7971]">
                      {cat.subtitle}
                    </p>
                  </div>

                  <div className="w-6 h-6 flex items-center justify-center shrink-0 opacity-70">
                    <Image
                      src="/profile/external_link.svg"
                      alt="Link"
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div className="w-full bg-white rounded-2xl p-5 shadow-xs border border-[#e0e3e1] flex flex-col gap-3">
            <h2 className="text-[18px] leading-[28px] font-semibold text-[#03130A]">
              Frequently Asked Questions
            </h2>

            <div className="flex flex-col border-t border-[#eff1f0] pt-1">
              {filteredFaqs.map((faq, idx) => {
                const isOpen = openFaq === faq.id;
                return (
                  <div
                    key={faq.id}
                    className={`flex flex-col py-3 cursor-pointer ${
                      idx !== filteredFaqs.length - 1 ? "border-b border-[#eff1f0]" : ""
                    }`}
                  >
                    <div
                      onClick={() => toggleFaq(faq.id)}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-[15px] leading-[22px] font-normal text-[#37493F]">
                        {faq.question}
                      </span>
                      <div className={`w-5 h-5 flex items-center justify-center shrink-0 opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                        <Image
                          src="/profile/chevron_down.svg"
                          alt="Toggle"
                          width={14}
                          height={14}
                          className="w-3.5 h-3.5 object-contain"
                        />
                      </div>
                    </div>

                    {isOpen && (
                      <p className="text-xs text-[#6B7971] leading-relaxed pt-2">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Call Reception  */}
          <div className="w-full pt-3 flex justify-center">
            <a
              href="tel:+91 11234567890"
              className="text-xs font-bold text-[#6B7971] tracking-wider uppercase py-3 px-6 rounded-xl hover:bg-slate-100 transition-colors"
            >
              call reception
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
