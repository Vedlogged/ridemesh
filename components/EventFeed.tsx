"use client";

import React, { useEffect } from "react";
import { useStellar } from "@/hooks/useStellar";
import { Clock, ExternalLink, Activity, Info, CheckCircle, AlertTriangle, Star, Shield } from "lucide-react";

export const EventFeed: React.FC = () => {
  const { events, pollBlockchainEvents, isSandbox } = useStellar();

  // Poll for events every 5 seconds
  useEffect(() => {
    pollBlockchainEvents();
    const interval = setInterval(() => {
      pollBlockchainEvents();
    }, 5000);
    return () => clearInterval(interval);
  }, [pollBlockchainEvents]);

  const getEventStyles = (type: string) => {
    switch (type) {
      case "requested":
        return {
          icon: <Activity className="w-4 h-4 text-cyan-400" />,
          bg: "bg-cyan-950/20 border-cyan-500/20",
          text: "text-cyan-400",
        };
      case "accepted":
        return {
          icon: <Shield className="w-4 h-4 text-indigo-400" />,
          bg: "bg-indigo-950/20 border-indigo-500/20",
          text: "text-indigo-400",
        };
      case "completed":
        return {
          icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
          bg: "bg-emerald-950/20 border-emerald-500/20",
          text: "text-emerald-400",
        };
      case "cancelled":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
          bg: "bg-rose-950/20 border-rose-500/20",
          text: "text-rose-400",
        };
      case "rated":
        return {
          icon: <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />,
          bg: "bg-amber-950/20 border-amber-500/20",
          text: "text-amber-400",
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-zinc-400" />,
          bg: "bg-zinc-950/20 border-zinc-500/20",
          text: "text-zinc-400",
        };
    }
  };

  const formatAddress = (addr: string) => {
    if (addr.length < 12) return addr;
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 6)}`;
  };

  const formatTime = (ts: number) => {
    const diffMs = Date.now() - ts;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="glass-card rounded-2xl p-5 h-[340px] flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
          <h3 className="font-bold text-white tracking-wide text-sm uppercase">Live RideMesh Events</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-cyan-950/30 text-cyan-400 border border-cyan-500/25 rounded-full text-[10px] font-semibold">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping"></span>
          {isSandbox ? "Simulated Live Feed" : "Live Blockchain"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <Info className="w-8 h-8 text-zinc-600 mb-2" />
            <p className="text-xs text-zinc-400">No events recorded yet.</p>
            <p className="text-[10px] text-zinc-500 mt-1">Simulated or on-chain events will stream here automatically.</p>
          </div>
        ) : (
          events.map((event) => {
            const styles = getEventStyles(event.type);
            return (
              <div 
                key={event.id}
                className={`p-3 rounded-xl border ${styles.bg} transition-all duration-300 hover:scale-[1.01]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 p-1 bg-zinc-900/80 border border-zinc-800 rounded-lg">
                      {styles.icon}
                    </div>
                    <div>
                      <p className="text-xs text-zinc-200 font-medium leading-relaxed">
                        {event.details}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500">
                        <span className="font-semibold text-zinc-400">
                          Actor: {formatAddress(event.walletAddress)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {event.hash && !event.hash.startsWith("conn_") && (
                    <a
                      href={
                        event.hash.startsWith("sim_") || event.hash === "sandbox_connection_hash"
                          ? "#"
                          : `https://stellar.expert/explorer/testnet/tx/${event.hash}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-cyan-400 transition-colors mt-0.5 shrink-0"
                      title={event.hash.startsWith("sim_") ? "Sandbox simulated hash" : "View on Stellar Expert"}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
