"use client";
import { useSyncExternalStore } from "react";

function subscribeViewport(callback) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

export default function DesktopPreview() {
  const isDesktop = useSyncExternalStore(
    subscribeViewport,
    () => window.innerWidth > 1024,
    () => false,
  );

  const url = useSyncExternalStore(
    () => () => {},
    () => window.location.href,
    () => "",
  );

  if (!isDesktop) return null;

  const devices = [
    {
      id: "tablet",
      label: "Tablet",
      width: 768,
      height: 1024,
      notch: false,
    },
    {
      id: "vivo-y12g",
      label: "Vivo Y12G (Mobile)",
      size: "6.51″",
      width: 360,
      height: 800,
      notch: true,
    },
    {
      id: "iphone-14",
      label: "iPhone 14 (Mobile)",
      size: "6.1″",
      width: 390,
      height: 844,
      notch: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-neutral-100 overflow-auto">
      {/* Dev Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        {/* <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-3 text-sm font-semibold text-gray-700">
            Grubpac Hospitality — Dev Preview
          </span>
        </div> */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="px-2.5 py-1 bg-orange-50 text-orange-600 rounded-full font-medium">
            Design Preview Mode
          </span>
        </div>
      </div>

      {/* Device Frames */}
      <div className="p-6 flex flex-wrap items-start justify-center gap-8">
        {devices.map((device) => (
          <div key={device.id} className="flex flex-col items-center gap-3">
            {/* Device Label */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-gray-200 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="text-xs font-semibold text-gray-700">
                {device.label}
              </span>
              {device.size && (
                <span className="text-[10px] text-orange-500">
                  {device.size}
                </span>
              )}
              <span className="text-[10px] text-gray-400">
                {device.width}px
              </span>
            </div>

            {/* Device Bezel */}
            <div
              className="relative bg-black rounded-[2.5rem] p-2.5 shadow-2xl"
              style={{ width: device.width + 20 }}
            >
              {/* Notch */}
              {device.notch && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-20" />
              )}
              {/* Screen / iframe */}
              <div
                className="relative overflow-hidden rounded-[2rem] bg-white"
                style={{
                  width: device.width,
                  height: device.height,
                }}
              >
                <iframe
                  src={url}
                  title={`${device.label} preview`}
                  className="w-full h-full border-0"
                  style={{
                    width: device.width,
                    height: device.height,
                  }}
                />
              </div>
              {/* Home indicator */}
              {device.notch && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/80 rounded-full" />
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center pb-8 text-xs text-gray-400">
        This desktop preview mirrors the live app at fixed device widths. Works
        only on screens wider than 1024px.
      </p>
    </div>
  );
}