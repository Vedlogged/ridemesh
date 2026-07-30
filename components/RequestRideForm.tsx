"use client";

import React, { useState } from "react";
import { useStellar } from "@/hooks/useStellar";
import { Navigation, Coins, ShieldAlert, CheckCircle2, ChevronRight, Cpu } from "lucide-react";

export const RequestRideForm: React.FC = () => {
  const { 
    tokenBalance, 
    requestRide, 
    txStatus, 
    isConnected, 
    connectWallet
  } = useStellar();

  const [fare, setFare] = useState<string>("12.5");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericFare = parseFloat(fare);
    if (isNaN(numericFare) || numericFare <= 0) {
      setErrorMsg("Please enter a valid fare amount greater than 0");
      return;
    }

    if (numericFare > parseFloat(tokenBalance)) {
      setErrorMsg(`Insufficient balance. You need at least ${fare} RIDE tokens, but only have ${tokenBalance}.`);
      return;
    }

    try {
      await requestRide(numericFare);
    } catch (e) {
      const error = e as Error;
      setErrorMsg(error.message || "Failed to create ride escrow");
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800/80">
          <Navigation className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-white tracking-wide text-sm uppercase">Request Ride / Escrow Fare</h3>
        </div>

        {isConnected ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1.5">
                Escrow Ride Fare (RIDE Tokens)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={fare}
                  onChange={(e) => setFare(e.target.value)}
                  disabled={txStatus === "pending"}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all pl-10"
                  placeholder="0.0"
                />
                <Coins className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                <span className="text-xs text-zinc-400 absolute right-3.5 top-3.5 font-bold uppercase">
                  RIDE
                </span>
              </div>
            </div>

            <div className="p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-medium">Available Balance</span>
              <span className="font-bold text-zinc-200">{tokenBalance} RIDE</span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-300 text-xs rounded-xl flex gap-2 items-start animate-pulse">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {txStatus === "success" && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/15 text-emerald-300 text-xs rounded-xl flex gap-2 items-center">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Ride requested & funds locked in escrow!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={txStatus === "pending"}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-zinc-950 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {txStatus === "pending" ? (
                "Locking Escrow..."
              ) : (
                <>
                  Request Escrow Ride <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="p-6 text-center flex flex-col items-center justify-center py-10 bg-zinc-950/30 border border-dashed border-zinc-800 rounded-xl">
            <Coins className="w-8 h-8 text-zinc-700 mb-3" />
            <h4 className="font-bold text-white text-sm">Wallet Disconnected</h4>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed mb-4">
              Please connect your wallet or launch the RideMesh developer simulator to request escrows.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[200px]">
              <button
                onClick={() => connectWallet(false)}
                className="w-full py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-100 rounded-lg text-xs font-semibold transition-colors"
              >
                Connect Wallet
              </button>
              <button
                onClick={() => connectWallet(true)}
                className="w-full py-2 bg-gradient-to-r from-indigo-950 to-cyan-950 hover:from-indigo-900 hover:to-cyan-900 border border-indigo-500/30 text-indigo-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                <Cpu className="w-3.5 h-3.5" /> Launch Simulator
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] text-zinc-500 border-t border-zinc-900 pt-3 leading-relaxed">
        RideMesh escrow ensures drivers only receive compensation after a passenger confirms arrival. Passenger cancel refunds locked fare immediately if driver not accepted.
      </div>
    </div>
  );
};
