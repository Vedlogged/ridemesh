"use client";

import React from "react";
import { useStellar } from "@/hooks/useStellar";
import { Star, ShieldAlert, Award, UserCheck, Flame } from "lucide-react";

export const DriverRanking: React.FC = () => {
  const { drivers } = useStellar();

  const getRankBadge = (score: number) => {
    if (score >= 48) return { label: "Elite Gold", color: "from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-300" };
    if (score >= 45) return { label: "Expert Silver", color: "from-slate-400/20 to-slate-500/10 border-slate-400/30 text-slate-300" };
    return { label: "Verified Driver", color: "from-cyan-950/20 to-indigo-950/10 border-cyan-500/25 text-cyan-300" };
  };

  const getStarRating = (score: number) => {
    return (score / 10).toFixed(1);
  };

  // Convert the drivers record into a list for sorting
  const driverList = Object.values(drivers).sort((a, b) => b.reputationScore - a.reputationScore);

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-white tracking-wide text-sm uppercase">Reputation Leaderboard</h3>
        </div>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
          Reputation Rankings
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
        {driverList.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <UserCheck className="w-8 h-8 text-zinc-700 mb-2" />
            <p className="text-xs text-zinc-400">No driver profiles active.</p>
            <p className="text-[10px] text-zinc-500 mt-1">Accept rides as driver to register score profiles.</p>
          </div>
        ) : (
          driverList.map((driver, index) => {
            const badge = getRankBadge(driver.reputationScore);
            return (
              <div 
                key={driver.address}
                className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/30 flex flex-wrap items-center justify-between gap-4 hover:border-zinc-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-zinc-950 text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold text-white block">
                      {driver.address}
                    </span>
                    <span className={`inline-flex items-center gap-1 mt-1 text-[9px] px-2 py-0.5 rounded-md border font-semibold bg-gradient-to-r ${badge.color}`}>
                      {driver.reputationScore >= 48 && <Flame className="w-2.5 h-2.5 text-amber-400 fill-amber-400/20" />}
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-5 text-right">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                      Completed Rides
                    </span>
                    <span className="text-sm font-bold text-zinc-200">
                      {driver.totalRides} rides
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                      Rep Score
                    </span>
                    <span className="flex items-center gap-1 mt-0.5 justify-end">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-bold text-amber-300">
                        {getStarRating(driver.reputationScore)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
