"use client";

import React from "react";
import { useStellar } from "@/hooks/useStellar";
import { ShieldCheck, ShieldAlert, Loader2, ExternalLink, History, Cpu } from "lucide-react";

export const TransactionHistory: React.FC = () => {
  const { txStatus, txHash, errorMessage, isSandbox } = useStellar();

  const getStatusDisplay = () => {
    switch (txStatus) {
      case "pending":
        return {
          icon: <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />,
          title: "Transaction Pending",
          description: "Submitting to Stellar consensus ledger...",
          color: "border-cyan-500/30 bg-cyan-950/10",
        };
      case "success":
        return {
          icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
          title: "Transaction Confirmed",
          description: "Stellar ledger has validated the escrow state.",
          color: "border-emerald-500/30 bg-emerald-950/10",
        };
      case "failed":
        return {
          icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
          title: "Transaction Failed",
          description: errorMessage || "The transaction was aborted by the network.",
          color: "border-rose-500/30 bg-rose-950/10",
        };
      default:
        return null;
    }
  };

  const statusCard = getStatusDisplay();
  const formatHash = (h: string) => {
    if (h.length < 16) return h;
    return `${h.substring(0, 8)}...${h.substring(h.length - 8)}`;
  };

  // Mock list of historic transactions for UI demonstration
  const recentTransactions = [
    {
      hash: "8c12a890e51c8a14b302c0b5c1c8a815a1f28b4a5d8f6e72c6f89025e1a148a0",
      action: "escrow_create",
      status: "success",
      fee: "0.0001 XLM",
      ledger: 49210984,
      sandbox: false,
    },
    {
      hash: "3a928e145b20cb88c1c46be091a18c6e2a149b5d120a1cf402da182a938fc289",
      action: "ride_accept",
      status: "success",
      fee: "0.00012 XLM",
      ledger: 49210920,
      sandbox: false,
    },
  ];

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col justify-between min-h-[340px]">
      <div>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800/80">
          <History className="w-5 h-5 text-secondary" />
          <h3 className="font-bold text-white tracking-wide text-sm uppercase">Transaction Tracker</h3>
        </div>

        {/* Current / Active Transaction Tracker */}
        {statusCard ? (
          <div className={`p-4 rounded-xl border ${statusCard.color} animate-pulse-glow mb-4`}>
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-zinc-950/60 rounded-lg border border-zinc-800/80 mt-0.5">
                {statusCard.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white leading-tight">
                  {statusCard.title}
                </h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {statusCard.description}
                </p>

                {txHash && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                        TX HASH
                      </span>
                      <span className="text-xs font-mono text-zinc-300">
                        {formatHash(txHash)}
                      </span>
                    </div>

                    {!txHash.startsWith("sim_") ? (
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1 bg-cyan-950/40 text-cyan-400 border border-cyan-500/20 rounded-lg flex items-center gap-1.5 hover:bg-cyan-900/40 hover:border-cyan-400/30 transition-all font-medium"
                      >
                        Explorer <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-md font-semibold flex items-center gap-1">
                        <Cpu className="w-2.5 h-2.5" /> Sandbox Sim
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-xl text-center flex flex-col items-center justify-center py-6 mb-4">
            <Loader2 className="w-6 h-6 text-zinc-700 animate-pulse mb-1.5" />
            <p className="text-xs text-zinc-400 font-medium">Idle Tracker</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Submit an escrow ride contract to track tx ledger status.</p>
          </div>
        )}
      </div>

      {/* Ledger History List */}
      <div>
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
          Recent Signatures / Ledger Actions
        </h4>
        <div className="space-y-2">
          {recentTransactions.map((tx) => (
            <div 
              key={tx.hash} 
              className="p-2.5 bg-zinc-950/40 border border-zinc-900 rounded-xl flex items-center justify-between text-xs hover:border-zinc-800 transition-colors"
            >
              <div>
                <span className="font-mono text-zinc-300 block font-semibold text-[11px]">
                  {tx.action === "escrow_create" ? "Escrow Created" : "Ride Accepted"}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
                  Hash: {formatHash(tx.hash)}
                </span>
              </div>
              <div className="text-right">
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-full text-[9px] font-bold uppercase tracking-wider">
                  Success
                </span>
                <span className="text-[9px] text-zinc-600 block mt-1">
                  Fee: {tx.fee}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
