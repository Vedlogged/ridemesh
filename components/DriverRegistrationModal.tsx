"use client";

import React, { useState } from "react";
import { useStellar } from "@/hooks/useStellar";
import { X, UserCheck, ShieldCheck, HelpCircle, Loader2 } from "lucide-react";

interface DriverRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DriverRegistrationModal: React.FC<DriverRegistrationModalProps> = ({ isOpen, onClose }) => {
  const { registerDriver, loadingStates, txStatus, errorMessage, clearError } = useStellar();

  const [name, setName] = useState("");
  const [vehicleNum, setVehicleNum] = useState("");
  const [vehicleType, setVehicleType] = useState("Electric Sedan");
  const [licenseHash, setLicenseHash] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!name.trim()) return setFormError("Driver name is required.");
    if (!vehicleNum.trim()) return setFormError("Vehicle license number is required.");
    if (!vehicleType.trim()) return setFormError("Vehicle type description is required.");
    
    // Generate a dummy SHA-256 styled hash if none provided
    const computedLicenseHash = licenseHash.trim() || 
      `sha256_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    try {
      await registerDriver(name, vehicleNum, vehicleType, computedLicenseHash);
      if (txStatus === "success" || !errorMessage) {
        // Close modal after delay
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isLoading = loadingStates["register-driver"] || false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl shadow-2xl animate-scale-up">
        {/* Decorative Top Glow Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-800/40 hover:bg-zinc-800/80 rounded-xl transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/25 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-wide uppercase">
              Register Driver Identity
            </h3>
            <p className="text-xs text-zinc-400">
              Create an immutable on-chain driver identity to start earning RIDE.
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleRegister} className="p-6 pt-2 space-y-4">
          
          {/* Output feedback states */}
          {formError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold">
              {formError}
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {txStatus === "success" && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Identity Registered successfully! Pending verification.</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-black block">
              Driver Full Name
            </label>
            <input
              type="text"
              disabled={isLoading || txStatus === "success"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-4 py-3 bg-zinc-950/40 border border-zinc-800 focus:border-purple-500/50 rounded-xl text-sm text-white focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-black block">
                Vehicle Plate #
              </label>
              <input
                type="text"
                disabled={isLoading || txStatus === "success"}
                value={vehicleNum}
                onChange={(e) => setVehicleNum(e.target.value)}
                placeholder="e.g. TX-982X"
                className="w-full px-4 py-3 bg-zinc-950/40 border border-zinc-800 focus:border-purple-500/50 rounded-xl text-sm text-white focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-black block">
                Vehicle Class
              </label>
              <select
                disabled={isLoading || txStatus === "success"}
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950/40 border border-zinc-800 focus:border-purple-500/50 rounded-xl text-sm text-white focus:outline-none transition-colors"
              >
                <option value="Electric Sedan">Electric Sedan</option>
                <option value="Luxury SUV">Luxury SUV</option>
                <option value="Standard Hybrid">Standard Hybrid</option>
                <option value="Premium Crossover">Premium Crossover</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-black block">
                License Document Hash
              </label>
              <span className="text-[9px] text-zinc-500 italic flex items-center gap-0.5">
                <HelpCircle className="w-2.5 h-2.5" /> Optional (auto-generated)
              </span>
            </div>
            <input
              type="text"
              disabled={isLoading || txStatus === "success"}
              value={licenseHash}
              onChange={(e) => setLicenseHash(e.target.value)}
              placeholder="e.g. IPFS CID hash key"
              className="w-full px-4 py-3 bg-zinc-950/40 border border-zinc-800 focus:border-purple-500/50 rounded-xl text-sm text-white focus:outline-none transition-colors"
            />
          </div>

          <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-zinc-800/55 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || txStatus === "success"}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-indigo-500/10 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Broadcasting Tx...
                </>
              ) : (
                <>
                  Register Wallet
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
