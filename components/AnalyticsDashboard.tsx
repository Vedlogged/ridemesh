"use client";

import React, { useEffect, useState } from "react";
import { useStellar } from "@/hooks/useStellar";
import { 
  BarChart3, 
  Coins, 
  CheckCircle, 
  Star, 
  Users, 
  ShieldAlert, 
  RefreshCw,
  TrendingUp,
  Activity,
  Award,
  MessageSquare,
  Send,
  ShieldCheck,
  Loader2
} from "lucide-react";

export const AnalyticsDashboard: React.FC = () => {
  const { 
    analytics, 
    fetchAnalytics, 
    registeredDrivers, 
    feedbacks, 
    fetchFeedbacks, 
    submitFeedback, 
    loadingStates, 
    walletAddress 
  } = useStellar();

  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchFeedbacks();
    const interval = setInterval(() => {
      fetchAnalytics();
      fetchFeedbacks();
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchAnalytics, fetchFeedbacks]);

  const formatVolume = (val: number | undefined) => {
    if (val === undefined) return "0.00";
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 6)}`;
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!comments.trim()) {
      setSubmitError("Feedback comments cannot be empty.");
      return;
    }

    try {
      await submitFeedback(rating, comments);
      setComments("");
      setRating(5);
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    } catch (e) {
      setSubmitError("Failed to submit feedback.");
    }
  };

  const driversList = [...registeredDrivers].sort((a, b) => b.reputationScore - a.reputationScore);
  const isFeedbackLoading = loadingStates["feedback"] || false;

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-wider uppercase bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" /> Platform Indexer Analytics
          </h2>
          <p className="text-xs text-zinc-400 font-medium">
            Real-time Soroban escrow operations and wallet activity synchronization.
          </p>
        </div>
        <button
          onClick={() => {
            fetchAnalytics();
            fetchFeedbacks();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Indexer
        </button>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="glass-card rounded-2xl p-5 border border-zinc-900/40 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total Escrow Volume</span>
            <div className="p-1.5 bg-cyan-950/20 text-cyan-400 rounded-lg border border-cyan-500/20">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h4 className="text-2xl font-black text-white leading-none">
              {formatVolume(analytics?.escrowVolumeTotal)} <span className="text-[10px] text-zinc-500 font-mono">RIDE</span>
            </h4>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-cyan-400 font-semibold">
              <TrendingUp className="w-3 h-3" />
              <span>Cumulative on Stellar ledger</span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card rounded-2xl p-5 border border-zinc-900/40 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Active Lockups</span>
            <div className="p-1.5 bg-indigo-950/20 text-indigo-400 rounded-lg border border-indigo-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h4 className="text-2xl font-black text-white leading-none">
              {formatVolume(analytics?.escrowVolumeActive)} <span className="text-[10px] text-zinc-500 font-mono">RIDE</span>
            </h4>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-400 font-semibold">
              <span>{analytics?.activeEscrows || 0} active ride contracts</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card rounded-2xl p-5 border border-zinc-900/40 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Settled & Completed</span>
            <div className="p-1.5 bg-emerald-950/20 text-emerald-400 rounded-lg border border-emerald-500/20">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h4 className="text-2xl font-black text-white leading-none">
              {analytics?.completedRides || 0} <span className="text-xs text-zinc-500 font-mono">RIDES</span>
            </h4>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400 font-semibold">
              <span>{formatVolume(analytics?.escrowVolumeSettled)} RIDE distributed</span>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-card rounded-2xl p-5 border border-zinc-900/40 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Average Rating</span>
            <div className="p-1.5 bg-amber-950/20 text-amber-400 rounded-lg border border-amber-500/20">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h4 className="text-2xl font-black text-white leading-none">
              {analytics?.averageRating ? analytics.averageRating.toFixed(2) : "0.00"} <span className="text-xs text-zinc-500">★</span>
            </h4>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-400 font-semibold">
              <span>On-chain reputations score</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS & LISTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Escrow Volume Visualizer (SVG) */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-5 border border-zinc-900/40 flex flex-col justify-between h-96">
          <div>
            <h3 className="font-bold text-white tracking-wide text-xs uppercase mb-1">
              Escrow Flow distribution
            </h3>
            <p className="text-[10px] text-zinc-400 font-medium">
              Ratio of platform locked funds compared to settled payouts and cancellations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-4">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#18181b" strokeWidth="3" />
                
                <circle 
                  cx="18" 
                  cy="18" 
                  r="15.915" 
                  fill="none" 
                  stroke="#10b981" 
                  strokeWidth="3.5" 
                  strokeDasharray="60 40" 
                  strokeDashoffset="0" 
                  className="transition-all duration-1000"
                />
                <circle 
                  cx="18" 
                  cy="18" 
                  r="15.915" 
                  fill="none" 
                  stroke="#6366f1" 
                  strokeWidth="3.5" 
                  strokeDasharray="25 75" 
                  strokeDashoffset="-60" 
                  className="transition-all duration-1000"
                />
                <circle 
                  cx="18" 
                  cy="18" 
                  r="15.915" 
                  fill="none" 
                  stroke="#3f3f46" 
                  strokeWidth="3.5" 
                  strokeDasharray="15 85" 
                  strokeDashoffset="-85" 
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black leading-none">Users</span>
                <span className="text-xl font-black text-white mt-1 leading-none">
                  {analytics?.dailyActiveUsers || 1}
                </span>
                <span className="text-[8px] text-zinc-400 mt-0.5">Wallets Active</span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs w-full max-w-[200px]">
              <div className="flex items-center justify-between border-b border-zinc-800/40 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <span className="text-zinc-300">Settled (Released)</span>
                </div>
                <span className="font-bold text-white font-mono">{formatVolume(analytics?.escrowVolumeSettled)} RIDE</span>
              </div>

              <div className="flex items-center justify-between border-b border-zinc-800/40 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                  <span className="text-zinc-300">Active (Locked)</span>
                </div>
                <span className="font-bold text-white font-mono">{formatVolume(analytics?.escrowVolumeActive)} RIDE</span>
              </div>

              <div className="flex items-center justify-between pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-600"></div>
                  <span className="text-zinc-400">Cancelled (Refunded)</span>
                </div>
                <span className="font-bold text-zinc-400 font-mono">
                  {analytics?.cancelledRides || 0} rides
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Active Drivers */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-5 border border-zinc-900/40 flex flex-col h-96">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60 mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-white tracking-wide text-xs uppercase">
                Active Drivers Directory
              </h3>
            </div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase">
              {driversList.length} Drivers
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {driversList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <ShieldAlert className="w-7 h-7 text-zinc-700 mb-1.5" />
                <p className="text-xs text-zinc-400 font-semibold">No driver registry records sync'd</p>
                <p className="text-[9px] text-zinc-500 max-w-xs mt-0.5">
                  Driver profile index is loaded dynamically from the backend listener.
                </p>
              </div>
            ) : (
              driversList.map((drv, idx) => (
                <div 
                  key={drv.wallet}
                  className="p-3 bg-zinc-950/20 border border-zinc-800 hover:border-zinc-700/60 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 font-black flex items-center justify-center border border-zinc-700 shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-white block truncate">{drv.name}</span>
                      <span className="text-[9px] text-zinc-500 font-mono block truncate">{drv.wallet}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right shrink-0">
                    <div>
                      <span className="text-[8px] text-zinc-500 uppercase block font-semibold">Rides</span>
                      <span className="font-bold text-zinc-200">{drv.totalRides}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-500 uppercase block font-semibold">Score</span>
                      <span className="flex items-center gap-0.5 text-amber-300 font-bold justify-end">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {(drv.reputationScore / 10).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* GUESTBOOK FEEDBACK PANEL (Level 4 compliance) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Side: Submit Feedback */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-5 border border-zinc-900/40">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/60 mb-4">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <h3 className="font-bold text-white tracking-wide text-xs uppercase">
              Onboarding Feedback Survey
            </h3>
          </div>
          
          <form onSubmit={handleFeedbackSubmit} className="space-y-4">
            {submitError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                {submitError}
              </div>
            )}
            
            {submitSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Feedback submitted successfully!
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-black block">
                Rate Application Experience
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 focus:outline-none transition-transform active:scale-90"
                  >
                    <Star 
                      className={`w-6 h-6 ${
                        star <= rating 
                          ? "text-amber-400 fill-amber-400" 
                          : "text-zinc-700 hover:text-amber-400"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-black block">
                Comments / Feedback
              </label>
              <textarea
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Submit your wallet connection audit experience..."
                className="w-full px-4 py-2.5 bg-zinc-950/40 border border-zinc-800 focus:border-purple-500/40 rounded-xl text-xs text-white focus:outline-none resize-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isFeedbackLoading || !walletAddress}
              className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isFeedbackLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Submit Connection Feedback
                </>
              )}
            </button>
            
            {!walletAddress && (
              <span className="text-[9px] text-zinc-500 italic block text-center mt-1">
                Please connect your Stellar wallet to submit feedback.
              </span>
            )}
          </form>
        </div>

        {/* Right Side: Onboarded Feedback Feed */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-5 border border-zinc-900/40 flex flex-col h-[328px]">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60 mb-4 shrink-0">
            <h3 className="font-bold text-white tracking-wide text-xs uppercase">
              Onboarded User Audits ({feedbacks.length})
            </h3>
            <span className="text-[9px] text-zinc-500 font-mono">
              Proof of Wallet Connection Feed
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {feedbacks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <MessageSquare className="w-7 h-7 text-zinc-700 mb-1.5" />
                <p className="text-xs text-zinc-400 font-semibold">No Connection Feedbacks Registered</p>
                <p className="text-[9px] text-zinc-500 max-w-xs mt-0.5">
                  Submit feedback using a connected Stellar address to verify audit trails.
                </p>
              </div>
            ) : (
              feedbacks.map((fb, idx) => (
                <div 
                  key={idx}
                  className="p-3 bg-zinc-950/20 border border-zinc-850 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-zinc-400 font-semibold truncate">
                      {formatAddress(fb.wallet)}
                    </span>
                    <div className="flex items-center gap-0.5 text-amber-300 font-bold shrink-0">
                      {[...Array(fb.rating)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-zinc-300 italic text-[11px] leading-relaxed">
                    &quot;{fb.comments}&quot;
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
