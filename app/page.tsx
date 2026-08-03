"use client";

import React, { useState, useEffect } from "react";
import { useStellar } from "@/hooks/useStellar";
import { WalletModal } from "@/components/WalletModal";
import { RequestRideForm } from "@/components/RequestRideForm";
import { TransactionHistory } from "@/components/TransactionHistory";
import { ActiveRides } from "@/components/ActiveRides";
import { DriverRanking } from "@/components/DriverRanking";
import { EventFeed } from "@/components/EventFeed";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { 
  Navigation, 
  Wallet, 
  LogOut, 
  Cpu, 
  HelpCircle, 
  Shield,
  Zap,
  Globe,
  Award,
  BarChart3,
  ListOrdered,
  Layers,
  CheckCircle2,
  Lock,
  ChevronRight,
  Activity
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
  const [activeView, setActiveView] = useState<"hub" | "leaderboard" | "analytics" | "events">("hub");

  // Poll balances if connected
  useEffect(() => {
    if (isConnected) {
      loadBalances();
      const interval = setInterval(() => {
        loadBalances();
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [isConnected, loadBalances]);

  const truncateAddress = (addr: string | null) => {
    if (!addr) return "";
    if (addr.length < 16) return addr;
    return `${addr.substring(0, 8)}...${addr.substring(addr.length - 8)}`;
  };

  return (
    <main className="min-h-screen pb-12 px-4 md:px-8 max-w-7xl mx-auto flex flex-col justify-between">
      <div>
        {/* HEADER NAVBAR */}
        <header className="py-5 mb-8 border-b border-zinc-800/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Navigation className="w-5 h-5 text-zinc-950 rotate-45" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-wider uppercase bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent flex items-center gap-1">
                RideMesh X
              </h1>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
                Decentralized Ride Escrow Protocol
              </p>
            </div>
          </div>

          {/* Sub Navigation Bar for connected sessions */}
          {isConnected && (
            <nav className="flex items-center bg-zinc-950/40 border border-zinc-800 rounded-xl p-1 gap-1 order-last sm:order-none w-full sm:w-auto overflow-x-auto shrink-0">
              <button
                onClick={() => setActiveView("hub")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeView === "hub"
                    ? "bg-zinc-800 text-cyan-400 border border-zinc-700/50"
                    : "text-zinc-400 hover:text-white border border-transparent"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Ride Hub
              </button>
              <button
                onClick={() => setActiveView("leaderboard")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeView === "leaderboard"
                    ? "bg-zinc-800 text-cyan-400 border border-zinc-700/50"
                    : "text-zinc-400 hover:text-white border border-transparent"
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" /> Leaderboard
              </button>
              <button
                onClick={() => setActiveView("analytics")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeView === "analytics"
                    ? "bg-zinc-800 text-cyan-400 border border-zinc-700/50"
                    : "text-zinc-400 hover:text-white border border-transparent"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Analytics
              </button>
              <button
                onClick={() => setActiveView("events")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeView === "events"
                    ? "bg-zinc-800 text-cyan-400 border border-zinc-700/50"
                    : "text-zinc-400 hover:text-white border border-transparent"
                }`}
              >
                <Activity className="w-3.5 h-3.5" /> Log Feed
              </button>
            </nav>
          )}

          <div className="flex items-center gap-3">
            {isConnected && (
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isSandbox 
                  ? "bg-indigo-950/20 text-indigo-300 border-indigo-500/25" 
                  : "bg-cyan-950/20 text-cyan-400 border-cyan-500/25"
              }`}>
                {isSandbox ? <Cpu className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                <span>{isSandbox ? "Sandbox Mode" : "Stellar Testnet"}</span>
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
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Disconnect Wallet"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsWalletModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-cyan-500/10 flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Wallet className="w-4 h-4" /> Connect Wallet
              </button>
            )}
          </div>
        </header>

        {/* WORKSPACE CONTENT AREA */}
        {isConnected ? (
          <div className="animate-slide-up duration-300">
            {activeView === "hub" && (
              <div className="space-y-6">
                {/* Top Panel Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <RequestRideForm />
                  </div>
                  <div>
                    <TransactionHistory />
                  </div>
                </div>

                {/* Bottom Panel Grid */}
                <div className="grid grid-cols-1 gap-6">
                  {/* Active Rides Manager (passenger & driver tabs) */}
                  <ActiveRides />
                </div>
              </div>
            )}

            {activeView === "leaderboard" && (
              <div className="grid grid-cols-1 gap-6 min-h-[500px]">
                <DriverRanking />
              </div>
            )}

            {activeView === "analytics" && (
              <div className="min-h-[500px]">
                <AnalyticsDashboard />
              </div>
            )}

            {activeView === "events" && (
              <div className="min-h-[500px]">
                <EventFeed />
              </div>
            )}
          </div>
        ) : (
          /* HERO LANDING PAGE */
          <div className="space-y-20 py-8 animate-slide-up">
            {/* HERO INTRODUCTION */}
            <div className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
              <div className="relative mb-6">
                <div className="absolute inset-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl animate-pulse mx-auto"></div>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center mx-auto border border-cyan-400/30">
                  <Navigation className="w-8 h-8 text-zinc-950 rotate-45 animate-bounce-slow" />
                </div>
              </div>

              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none uppercase">
                Decentralized Escrows & <br />
                <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Trusted Driver Reputation
                </span>
              </h2>
              
              <p className="text-zinc-400 text-sm md:text-base mt-5 max-w-2xl leading-relaxed">
                RideMesh X is a trustless, decentralized ride-sharing platform. We secure passenger fares in escrow smart contracts on Stellar Testnet and maintain transparent on-chain ratings.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center justify-center w-full max-w-md">
                <button
                  onClick={() => setIsWalletModalOpen(true)}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-500/15 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Zap className="w-4 h-4" /> Connect Stellar Wallet
                </button>
                
                <button
                  onClick={() => connectWallet(true)}
                  className="w-full sm:w-auto px-6 py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Cpu className="w-4 h-4 text-indigo-400" /> Start Sandbox Demo
                </button>
              </div>
            </div>

            {/* PLATFORM STATISTICS BAR */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto pt-6 border-t border-zinc-900">
              <div className="text-center p-4">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Stellar Network</span>
                <span className="text-xl md:text-2xl font-black text-white mt-1 block">TESTNET</span>
              </div>
              <div className="text-center p-4 border-l border-zinc-900">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Escrow Fee Rate</span>
                <span className="text-xl md:text-2xl font-black text-emerald-400 mt-1 block">0% FEE</span>
              </div>
              <div className="text-center p-4 border-l border-zinc-900">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Settlement Speed</span>
                <span className="text-xl md:text-2xl font-black text-indigo-400 mt-1 block">&lt; 5 SEC</span>
              </div>
              <div className="text-center p-4 border-l border-zinc-900">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Driver Trust</span>
                <span className="text-xl md:text-2xl font-black text-amber-300 mt-1 block">ON-CHAIN</span>
              </div>
            </div>

            {/* HOW IT WORKS TIMELINE */}
            <div className="max-w-5xl mx-auto space-y-12">
              <div className="text-center">
                <h3 className="text-2xl font-black text-white uppercase tracking-wider">How RideMesh X Works</h3>
                <p className="text-xs text-zinc-400 mt-1">Four steps to trustless, decentralized journeys.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
                {/* Timeline Step 1 */}
                <div className="glass-card rounded-2xl p-5 border border-zinc-900 relative">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 font-black flex items-center justify-center text-sm border border-zinc-700 mb-4">
                    1
                  </div>
                  <h4 className="font-bold text-sm text-zinc-100 uppercase tracking-wide flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-cyan-400" /> Book & Escrow
                  </h4>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Passenger locks ride fare inside a secure Soroban escrow contract. Fares are secured in RIDE tokens.
                  </p>
                </div>

                {/* Timeline Step 2 */}
                <div className="glass-card rounded-2xl p-5 border border-zinc-900 relative">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 font-black flex items-center justify-center text-sm border border-zinc-700 mb-4">
                    2
                  </div>
                  <h4 className="font-bold text-sm text-zinc-100 uppercase tracking-wide flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-purple-400" /> Verify & Accept
                  </h4>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Drivers register on-chain and get verified by the admin. Only verified driver identities can accept ride requests.
                  </p>
                </div>

                {/* Timeline Step 3 */}
                <div className="glass-card rounded-2xl p-5 border border-zinc-900 relative">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 font-black flex items-center justify-center text-sm border border-zinc-700 mb-4">
                    3
                  </div>
                  <h4 className="font-bold text-sm text-zinc-100 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Payout Release
                  </h4>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Once the trip is completed, the passenger confirms arrival. The smart contract instantly routes the escrowed tokens to the driver.
                  </p>
                </div>

                {/* Timeline Step 4 */}
                <div className="glass-card rounded-2xl p-5 border border-zinc-900 relative">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 font-black flex items-center justify-center text-sm border border-zinc-700 mb-4">
                    4
                  </div>
                  <h4 className="font-bold text-sm text-zinc-100 uppercase tracking-wide flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" /> Reputation
                  </h4>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Passenger rates the driver. The rating is calculated and stored on-chain inside the Reputation contract state.
                  </p>
                </div>
              </div>
            </div>

            {/* KEY VALUE PROPOSITIONS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <div className="glass-card rounded-2xl p-6 border border-zinc-900">
                <div className="p-2.5 bg-cyan-950/30 text-cyan-400 w-fit rounded-lg border border-cyan-500/25 mb-4">
                  <Shield className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-zinc-100 uppercase tracking-wide">Trustless Fares</h4>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Never worry about payment disputes. Fares are locked in a decentralized contract and automatically refunded to passengers if cancelled.
                </p>
              </div>
              
              <div className="glass-card rounded-2xl p-6 border border-zinc-900">
                <div className="p-2.5 bg-indigo-950/30 text-indigo-400 w-fit rounded-lg border border-indigo-500/25 mb-4">
                  <Award className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-zinc-100 uppercase tracking-wide">Immutable Driver Scores</h4>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Driver ratings are calculated on-chain. This creates an tamper-proof ranking directory that traditional companies cannot manipulate.
                </p>
              </div>

              <div className="glass-card rounded-2xl p-6 border border-zinc-900">
                <div className="p-2.5 bg-purple-950/30 text-purple-400 w-fit rounded-lg border border-purple-500/25 mb-4">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-zinc-100 uppercase tracking-wide">Stellar Wallet Integration</h4>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Full wallet connection using freighter, albedo, or xbull with experimental mode validation for secure client transactions.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="mt-20 pt-5 border-t border-zinc-900 text-center flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
          © {new Date().getFullYear()} RideMesh X protocol. All rights reserved.
        </span>
        <span className="text-[9px] text-zinc-600 font-mono">
          Powered by Stellar Soroban & Next.js App Router
        </span>
      </footer>

      {/* WALLET CONNECTION MODAL POPUP */}
      <WalletModal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
      />
    </main>
  );
}
