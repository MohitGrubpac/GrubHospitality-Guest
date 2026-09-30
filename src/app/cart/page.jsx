"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/component/providers/CartProvider";
import { useOrders } from "@/component/providers/OrdersProvider";
import { useAuth } from "@/component/providers/AuthProvider";
import { useRoom } from "@/component/providers/RoomProvider";
import SwitchRoomModal from "@/component/ui/SwitchRoomModal";
import VegIndicator from "@/component/ui/VegIndicator";
import { showError } from "@/component/ui/Toast";
import { MAX_CART_QUANTITY } from "@/services/cartService";

// Qty stepper for cart
function QtyStepper({ qty, onDecrease, onIncrease, busy }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onDecrease}
        disabled={busy}
        className="w-7 h-7 flex items-center justify-center text-[#fe480b] text-lg font-bold cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="text-sm font-semibold text-[#03130a] min-w-[16px] text-center">
        {qty}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={busy || qty >= MAX_CART_QUANTITY}
        className="w-7 h-7 flex items-center justify-center text-[#fe480b] text-lg font-bold cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

// Scalloped bill summary card
function BillSummaryCard({ subtotal }) {
  return (
    <div
      className="relative w-full min-h-[260px] mx-auto"
      style={{
        width: "calc(100% + 19px)",
        marginLeft: "-8px",
        backgroundImage: "url('/kitchen/subtract.png')",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="px-11 py-9 flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#03130a]">Bill Summary</h2>
          <p className="text-xs text-[#6b7971] mt-0.5">
            Your total amount to pay{" "}
            <span className="text-green-600 font-semibold">₹{subtotal}</span>
          </p>
        </div>
        <div className="h-px bg-[#eff1f0]" />
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6b7971]">Items Total</span>
          <span className="font-semibold text-[#03130a]">₹{subtotal}</span>
        </div>
        <p className="text-[11px] text-[#6b7971]">
          *Bill will be added to your hotel bill.
        </p>
        <div className="h-px" style={{ borderTop: "1px dashed #e0e3e1" }} />
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-[#03130a]">Grand Total</span>
          <span className="font-bold text-[#03130a]">₹{subtotal}</span>
        </div>
      </div>
    </div>
  );
}

// Delivery details section
function DeliveryDetails({ selectedRoom, onChangeRoom, isMultipleRooms, guest }) {
  return (
    <div className="px-5 py-5 flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-bold text-[#03130a]">Delivery Details</h2>
        <p className="text-xs text-[#6b7971] mt-0.5">Delivering to your room</p>
      </div>
      <div className="grid grid-cols-2 gap-y-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[#03130a]">20-30 Minutes</span>
          <span className="text-xs text-[#6b7971]">Estimated Delivery</span>
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-[#03130a]">{selectedRoom || "-"}</span>
          </div>
          <span className="text-xs text-[#6b7971]">
            Room No.{" "}
            {isMultipleRooms && (
              <button
                type="button"
                onClick={onChangeRoom}
                className="text-xs underline text-[#fe480b] font-semibold cursor-pointer hover:underline"
                id="change-room-btn"
              >
                Change
              </button>
            )}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-[#03130a]">{guest?.reservationId || "-"}</span>
          <span className="text-xs text-[#6b7971]">Reservation ID</span>
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <span className="font-semibold text-[#03130a]">{guest?.name || "-"}</span>
          <span className="text-xs text-[#6b7971]">Guest Name</span>
        </div>
      </div>
    </div>
  );
}

function AddInstructionButton({ onClick, label = "Add Instruction" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 border border-[#fe480b] rounded-lg px-4 py-2 cursor-pointer hover:bg-red-50 transition-colors"
      id="add-instruction-btn"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
          stroke="#fe480b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
          stroke="#fe480b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-xs font-semibold text-[#fe480b] uppercase tracking-wide">{label}</span>
    </button>
  );
}

function CartEmptyState({ onBrowse }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center px-8 flex-1">
      <div className="w-16 h-16 rounded-full bg-[#f7f8fa] flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
            stroke="#6b7971"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke="#6b7971" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-[#03130a]">Your cart is empty</h2>
        <p className="text-sm text-[#6b7971]">Add dishes from any kitchen to get started.</p>
      </div>
      <button
        type="button"
        onClick={onBrowse}
        className="mt-2 px-6 py-2.5 border border-[#fe480b] text-[#fe480b] hover:bg-red-50 rounded-xl text-sm font-bold uppercase transition-colors cursor-pointer"
      >
        Browse Kitchens
      </button>
    </div>
  );
}

export default function CartPage() {
  const router = useRouter();
  const {
    kitchens,
    items,
    subtotal,
    restaurantCount,
    isEmpty,
    isLoading,
    isMutating,
    mutatingId,
    increment,
    removeItem,
    clearCart,
    checkout,
    buildSpecialInstructions,
  } = useCart();
  const { placeOrder } = useOrders();
  const { guest } = useAuth();
  const {
    selectedRoom,
    setSelectedRoom,
    isMultipleRooms,
  } = useRoom();

  const [orderInstruction, setOrderInstruction] = useState("");
  const [showInstruction, setShowInstruction] = useState(false);
  const [isRoomSwitchOpen, setIsRoomSwitchOpen] = useState(false);

  const isMultiKitchen = restaurantCount > 1;

  const handlePlaceOrder = async () => {
    const created = await checkout({
      specialInstructions: buildSpecialInstructions(orderInstruction),
    });

    if (!created || created.length === 0) return;

    await placeOrder(created);
    router.push("/order-status");
  };

  const handleOrderNow = () => {
    handlePlaceOrder();
  };

  if (isLoading && items.length === 0) {
    return (
      <div className="w-full min-h-screen bg-[#f7f8fa] flex flex-col items-center">
        <div className="w-full max-w-[480px] sm:max-w-[768px] min-h-screen bg-white flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#fe480b] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="w-full min-h-screen bg-[#f7f8fa] flex flex-col items-center">
        <div className="w-full max-w-[480px] sm:max-w-[768px] min-h-screen bg-white flex flex-col">
          <div className="flex items-center gap-3 px-4 py-4 border-b border-[#eff1f0]">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Go back"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 18L9 12L15 6"
                  stroke="#03130a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <h1 className="text-base font-bold text-[#03130a]">Cart</h1>
          </div>
          <CartEmptyState onBrowse={() => router.push("/home")} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#f7f8fa] flex flex-col items-center">
      <div className="w-full max-w-[480px] sm:max-w-[768px] min-h-screen bg-[#f7f8fa] flex flex-col pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-[#eff1f0]">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="#03130a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 className="text-base font-bold text-[#03130a]">Cart</h1>
          {isMultiKitchen && (
            <span className="ml-auto text-[11px] font-semibold uppercase tracking-wide text-[#6b7971]">
              {restaurantCount} kitchens
            </span>
          )}
        </div>

        {/* Items Section */}
        <div className="mt-3 mx-4 bg-white rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#03130a]">Items</h2>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Remove all items from your cart?")) clearCart();
              }}
              className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7971] cursor-pointer hover:text-[#fe480b] transition-colors"
            >
              Clear
            </button>
          </div>

          {kitchens.map((kitchen) => (
            <div key={kitchen.restaurantId}>
              {isMultiKitchen && (
                <div className="px-5 pt-3 pb-1">
                  <span className="text-xs font-bold text-[#03130a] uppercase tracking-wide">
                    {kitchen.kitchenName}
                  </span>
                </div>
              )}

              {kitchen.entries.map((entry) => {
                const busy = isMutating && mutatingId === entry.item.id;

                return (
                  <div
                    key={entry.item.id}
                    className="flex items-center justify-between px-5 py-4 border-t border-dashed border-[#e0e3e1]"
                  >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="pt-0.5">
                        <VegIndicator isVeg={entry.item.isVeg} size={14} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-[#03130a] leading-tight truncate">
                          {entry.item.name}
                        </span>
                        <span className="text-xs text-[#6b7971] mt-0.5">
                          ₹{entry.item.price}
                        </span>
                        {!entry.available && (
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#b42318] mt-1">
                            Unavailable
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <QtyStepper
                        qty={entry.qty}
                        busy={busy}
                        onDecrease={() => increment(entry.item.id, -1)}
                        onIncrease={() => increment(entry.item.id, 1)}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(entry.item.id)}
                        disabled={busy}
                        className="text-[#6b7971] hover:text-[#ff3333] transition-colors cursor-pointer disabled:opacity-40"
                        aria-label={`Remove ${entry.item.name}`}
                      >
                        <Image
                          src="/profile/trash.svg"
                          alt="Remove"
                          width={16}
                          height={16}
                          className="w-4 h-4 object-contain"
                        />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="px-5 py-3 border-t border-dashed border-[#e0e3e1] flex items-center justify-between">
                <span className="text-xs text-[#6b7971]">Kitchen total</span>
                <span className="text-sm font-bold text-[#03130a]">₹{kitchen.subtotal}</span>
              </div>
            </div>
          ))}

          {/* Order instructions */}
          <div className="px-5 pb-4 pt-2 border-t border-dashed border-[#e0e3e1]">
            {showInstruction ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={orderInstruction}
                  onChange={(event) => setOrderInstruction(event.target.value)}
                  placeholder="Add special instructions for your order..."
                  rows={3}
                  maxLength={1000}
                  className="w-full border border-[#e0e3e1] rounded-lg px-3 py-2 text-base text-[#03130a] placeholder:text-[#b0b8b4] outline-none resize-none focus:border-[#fe480b] transition-colors"
                  id="order-instruction-input"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#6b7971]">
                    {orderInstruction.length}/1000
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowInstruction(false)}
                    className="flex items-center gap-1.5 border border-[#fe480b] text-[#fe480b] rounded-lg px-4 py-2 text-xs font-bold uppercase cursor-pointer hover:bg-red-50 transition-colors"
                  >
                    Submit
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 18L15 12L9 6"
                        stroke="#fe480b"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <AddInstructionButton onClick={() => setShowInstruction(true)} />
            )}
          </div>
        </div>

        {/* Bill Summary (scalloped ticket style) */}
        <div className="mx-auto mx-4 w-full">
          <BillSummaryCard subtotal={subtotal} />
        </div>

        {/* Delivery Details */}
        <div className="mx-4 bg-white rounded-2xl">
          <DeliveryDetails
            selectedRoom={selectedRoom}
            onChangeRoom={() => setIsRoomSwitchOpen(true)}
            isMultipleRooms={isMultipleRooms}
            guest={guest}
          />
        </div>
      </div>

      {/* Fixed bottom buttons */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] sm:max-w-[768px] bg-white border-t border-[#eff1f0] px-4 py-3 z-30">
        <button
          type="button"
          onClick={handleOrderNow}
          disabled={isMutating || !selectedRoom}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#fe480b] text-white rounded-xl text-xs font-bold uppercase tracking-wide cursor-pointer hover:bg-[#e4450a] transition-colors disabled:opacity-60"
          id="order-now-btn"
        >
          {isMutating ? "Placing order..." : `Place order · ₹${subtotal}`}
        </button>
        {!selectedRoom && (
          <p className="text-[11px] text-center text-[#b42318] mt-2">
            No room number on your profile. Please update it before ordering.
          </p>
        )}
      </div>

      {/* Switch Room Modal */}
      <SwitchRoomModal
        key={isRoomSwitchOpen ? `room-open-${selectedRoom}` : "room-closed"}
        isOpen={isRoomSwitchOpen}
        onClose={() => setIsRoomSwitchOpen(false)}
        currentRoom={selectedRoom}
        onConfirm={(room) => {
          setIsRoomSwitchOpen(false);
          if (!room) {
            showError("No room number available on your profile.");
            return;
          }
          setSelectedRoom(room);
        }}
      />
    </div>
  );
}
