"use client";

import React, { useState, useEffect } from "react";
import { useStellar } from "@/hooks/useStellar";
import { WalletModal } from "@/components/WalletModal";
import { RequestRideForm } from "@/components/RequestRideForm";
import { TransactionHistory } from "@/components/TransactionHistory";
import { ActiveRides } from "@/components/ActiveRides";
import { DriverRanking } from "@/components/DriverRanking";
import { EventFeed } from "@/components/EventFeed";
import { 
  Navigation, 
  Wallet, 
  LogOut, 
  Cpu, 
  HelpCircle, 
  ExternalLink,
  Shield,
  Zap,
  Globe,
  Award
} from "lucide-react";

export default function Home() {
  const { 
    isConnected, 
    walletAddress, 
    xlmBalance, 
    tokenBalance, 
    disconnectWallet, 
    connectWallet,
    isSandbox,
    loadBalances
  } = useStellar();

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Poll balances every 8 seconds if connected via real wallet
  useEffect(() => {
    if (isConnected && !isSandbox) {
      loadBalances();
      const interval = setInterval(() => {
        loadBalances();
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [isConnected, isSandbox, loadBalances]);

  const truncateAddress = (addr: string | null) => {
    if (!addr) return "";
    if (addr.length < 16) return addr;
    return `${addr.substring(0, 8)}...${addr.substring(addr.length - 8)}`;
  };

  return (
    <main className="min-h-screen pb-12 px-4 md:px-8 max-w-7xl mx-auto">
      {/* HEADER NAVBAR */}
      <header className="py-5 mb-8 border-b border-zinc-800/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Navigation className="w-5 h-5 text-zinc-950 rotate-45" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-wider uppercase bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent flex items-center gap-1">
              RideMesh
            </h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
              Decentralized Ride-Sharing Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Network Indicator badge */}
          {isConnected && (
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isSandbox 
                ? "bg-indigo-950/20 text-indigo-300 border-indigo-500/25" 
                : "bg-cyan-950/20 text-cyan-400 border-cyan-500/25"
            }`}>
              {isSandbox ? <Cpu className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
              <span>{isSandbox ? "Sandbox Simulator" : "Stellar Testnet"}</span>
            </div>
          )}

          {isConnected ? (
            <div className="flex items-center gap-4 bg-zinc-900/40 border border-zinc-800 rounded-xl p-1.5 pl-3">
              <div className="hidden lg:block text-right">
                <span className="text-[10px] text-zinc-500 font-mono block">
                  {truncateAddress(walletAddress)}
                </span>
                <span className="text-xs text-zinc-300 font-bold mt-0.5 block">
                  {tokenBalance} RIDE • {parseFloat(xlmBalance).toFixed(2)} XLM
                </span>
              </div>
              <button
                onClick={disconnectWallet}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors"
                title="Disconnect Wallet"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-cyan-500/10 flex items-center gap-1.5 active:scale-95"
            >
              <Wallet className="w-4 h-4" /> Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* DASHBOARD GRID */}
      {isConnected ? (
        <div className="space-y-6">
          {/* Top Panel Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="animate-slide-up">
              <RequestRideForm />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
              <TransactionHistory />
            </div>
          </div>

          {/* Bottom Panel Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Active Rides Manager (passenger & driver tabs) */}
            <div className="lg:col-span-7 animate-slide-up" style={{ animationDelay: "200ms" }}>
              <ActiveRides />
            </div>

            {/* Drivers reputation leaderboard */}
            <div className="lg:col-span-5 animate-slide-up" style={{ animationDelay: "300ms" }}>
              <DriverRanking />
            </div>
          </div>

          {/* Live Blockchain Event Logging Output */}
          <div className="animate-slide-up" style={{ animationDelay: "400ms" }}>
            <EventFeed />
          </div>
        </div>
      ) : (
        /* HERO LANDING PLACEHOLDER - BEAUTIFULLY CUSTOMIZED */
        <div className="py-12 md:py-20 flex flex-col items-center justify-center text-center animate-slide-up">
          <div className="relative mb-6">
            <div className="absolute inset-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl animate-pulse-glow mx-auto"></div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center mx-auto border border-cyan-400/30">
              <Navigation className="w-8 h-8 text-zinc-950 rotate-45" />
            </div>
          </div>

          <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight max-w-2xl leading-none">
            DECENTRALIZED RIDE ESCROW &{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-secondary bg-clip-text text-transparent">
              TRUSTED REPUTATION
            </span>
          </h2>
          
          <p className="text-zinc-400 text-sm md:text-base mt-4 max-w-lg leading-relaxed">
            RideMesh secures passenger fares using smart contract token escrows on the Stellar ledger, releasing funds only upon arrival. Drivers build immutable on-chain ratings.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center justify-center w-full px-4">
            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2 active:scale-95"
            >
              <Zap className="w-4 h-4" /> Initialize Application
            </button>
            
            <button
              onClick={() => connectWallet(true)}
              className="w-full sm:w-auto px-6 py-3 bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Cpu className="w-4 h-4 text-indigo-400" /> Start Sandbox Demo
            </button>
          </div>

          {/* Value Props */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 max-w-4xl w-full text-left">
            <div className="glass-card rounded-2xl p-5 border border-zinc-900">
              <div className="p-2 bg-cyan-950/30 text-cyan-400 w-fit rounded-lg border border-cyan-500/25 mb-3.5">
                <Shield className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-zinc-100 uppercase tracking-wide">Secure Escrows</h4>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Fares are deposited directly into a Soroban contract. Refunds can be claimed if a driver isn't assigned or cancels.
              </p>
            </div>
            
            <div className="glass-card rounded-2xl p-5 border border-zinc-900">
              <div className="p-2 bg-indigo-950/30 text-indigo-400 w-fit rounded-lg border border-indigo-500/25 mb-3.5">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-zinc-100 uppercase tracking-wide">Reputation Ranks</h4>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Driver ratings are computed and stored directly on-chain, creating an un-biasable driver profile score.
              </p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-zinc-900">
              <div className="p-2 bg-pink-950/30 text-pink-400 w-fit rounded-lg border border-pink-500/25 mb-3.5">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-zinc-100 uppercase tracking-wide">Multi-Wallet Connect</h4>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Seamless support for Freighter, Albedo, and xBull using the recommended StellarWalletsKit SDK abstraction layer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* WALLET CONNECTION MODAL POPUP */}
      <WalletModal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
      />
    </main>
  );
}
