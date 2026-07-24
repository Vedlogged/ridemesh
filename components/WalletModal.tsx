"use client";

import React from "react";
import { useStellar } from "@/hooks/useStellar";
import { Wallet, X, ShieldAlert, Cpu } from "lucide-react";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { connectWallet, isConnecting, errorMessage, clearError } = useStellar();

  if (!isOpen) return null;

  const wallets = [
    {
      id: "freighter",
      name: "Freighter Wallet",
      icon: "⚡",
      description: "Official Stellar Browser Extension Wallet",
      sandbox: false,
    },
    {
      id: "albedo",
      name: "Albedo Link",
      icon: "🌌",
      description: "Web-based secure Stellar wallet signer",
      sandbox: false,
    },
    {
      id: "xbull",
      name: "xBull Wallet",
      icon: "🐂",
      description: "Developer-focused browser extension wallet",
      sandbox: false,
    },
    {
      id: "sandbox",
      name: "RideMesh Sandbox",
      icon: "⚙️",
      description: "Developer Simulator. Test everything instantly!",
      sandbox: true,
    },
  ];

  const handleConnect = async (isSandbox: boolean) => {
    await connectWallet(isSandbox);
    // If successful, close modal
    if (!errorMessage) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div 
        className="w-full max-w-md glass-card rounded-2xl p-6 relative animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-cyan-950/50 border border-cyan-500/30 rounded-xl">
            <Wallet className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Connect Wallet</h2>
            <p className="text-xs text-zinc-400">Select how you want to connect to Stellar</p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3 bg-red-950/30 border border-red-500/20 text-red-300 text-xs rounded-xl flex gap-2.5 items-start">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1">
              <span className="font-semibold">Connection Error:</span> {errorMessage}
              <button 
                onClick={clearError}
                className="block mt-1 font-semibold underline text-red-400 hover:text-red-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3.5">
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              disabled={isConnecting}
              onClick={() => handleConnect(wallet.sandbox)}
              className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                wallet.sandbox
                  ? "bg-gradient-to-r from-indigo-950/40 to-cyan-950/40 hover:from-indigo-950/60 hover:to-cyan-950/60 border-indigo-500/30 hover:border-indigo-400/50"
                  : "bg-zinc-900/30 hover:bg-zinc-800/40 border-zinc-800 hover:border-cyan-500/30"
              } group disabled:opacity-50`}
            >
              <span className="text-2xl p-2 bg-zinc-950/50 rounded-lg group-hover:scale-110 transition-transform">
                {wallet.icon}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                    {wallet.name}
                  </span>
                  {wallet.sandbox && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md font-semibold flex items-center gap-1">
                      <Cpu className="w-2.5 h-2.5" /> Demo Mode
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{wallet.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="text-center mt-6">
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            By connecting a wallet, you authorize RideMesh to propose transactions on your behalf. Always verify the transaction details in your wallet client before signing.
          </p>
        </div>
      </div>
    </div>
  );
};
