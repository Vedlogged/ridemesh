"use client";

import React, { useState } from "react";
import { useStellar, Ride } from "@/hooks/useStellar";
import { Star, Shield, Car, Check, X, Navigation, Award, MessageSquare } from "lucide-react";

export const ActiveRides: React.FC = () => {
  const { 
    rides, 
    walletAddress, 
    acceptRide, 
    completeRide, 
    cancelRide, 
    rateDriver, 
    txStatus 
  } = useStellar();

  const [activeTab, setActiveTab] = useState<"passenger" | "driver">("passenger");
  const [hoveredStars, setHoveredStars] = useState<Record<number, number>>({});
  const [selectedRatings, setSelectedRatings] = useState<Record<number, number>>({});

  const formatAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr || "Waiting...";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 6)}`;
  };

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 rounded-full text-[10px] font-semibold uppercase">Requested</span>;
      case 1:
        return <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 rounded-full text-[10px] font-semibold uppercase animate-pulse">In Progress</span>;
      case 2:
        return <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-full text-[10px] font-semibold uppercase">Completed</span>;
      case 3:
        return <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 border border-zinc-700/55 rounded-full text-[10px] font-semibold uppercase">Cancelled</span>;
      default:
        return null;
    }
  };

  // Filter rides
  const myRidesAsPassenger = rides.filter(r => r.passenger === walletAddress || r.passenger.startsWith("GD Passenger"));
  const availableRidesForDrivers = rides.filter(r => r.status === 0 && r.passenger !== walletAddress);

  const handleRate = async (rideId: number, stars: number) => {
    await rateDriver(rideId, stars);
  };

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col h-[520px]">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800/80 mb-5">
        <button
          onClick={() => setActiveTab("passenger")}
          className={`flex-1 pb-3 text-sm font-bold tracking-wider uppercase transition-colors relative flex items-center justify-center gap-2 ${
            activeTab === "passenger" ? "text-cyan-400" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Navigation className="w-4 h-4" /> Passenger Hub ({myRidesAsPassenger.length})
          {activeTab === "passenger" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 animate-pulse"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("driver")}
          className={`flex-1 pb-3 text-sm font-bold tracking-wider uppercase transition-colors relative flex items-center justify-center gap-2 ${
            activeTab === "driver" ? "text-secondary" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Car className="w-4 h-4" /> Driver Hub ({availableRidesForDrivers.length})
          {activeTab === "driver" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary animate-pulse"></span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {activeTab === "passenger" ? (
          myRidesAsPassenger.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <Navigation className="w-10 h-10 text-zinc-700 mb-2.5" />
              <h4 className="font-bold text-white text-sm">No Active Passenger Rides</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                Use the Request Ride panel to lock tokens in escrow and hire a driver.
              </p>
            </div>
          ) : (
            myRidesAsPassenger.map((ride) => (
              <div 
                key={ride.id}
                className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/20 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold">Ride ID</span>
                    <h5 className="font-bold text-white text-sm font-mono mt-0.5">#MR-{ride.id}</h5>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(ride.status)}
                    <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-lg border border-cyan-500/20 text-xs">
                      {ride.fare} RIDE
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-2.5 border-y border-zinc-900 mb-3 text-xs">
                  <div>
                    <span className="text-zinc-500 uppercase block text-[9px] font-semibold">Driver Assigned</span>
                    <span className="font-medium text-zinc-300 mt-1 block">
                      {ride.status === 0 ? "Searching..." : formatAddress(ride.driver)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase block text-[9px] font-semibold">Escrow Escrow Status</span>
                    <span className="font-medium text-zinc-300 mt-1 block">
                      {ride.status === 0 && "Locked in Escrow"}
                      {ride.status === 1 && "Active Escrow"}
                      {ride.status === 2 && "Escrow Released"}
                      {ride.status === 3 && "Escrow Refunded"}
                    </span>
                  </div>
                </div>

                {/* Operations based on status */}
                {ride.status === 0 && (
                  <button
                    disabled={txStatus === "pending"}
                    onClick={() => cancelRide(ride.id)}
                    className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel Request & Refund Escrow
                  </button>
                )}

                {ride.status === 1 && (
                  <button
                    disabled={txStatus === "pending"}
                    onClick={() => completeRide(ride.id)}
                    className="w-full py-2 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/10 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Confirm Arrival & Release Escrow
                  </button>
                )}

                {ride.status === 2 && ride.rating === 0 && (
                  <div className="pt-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block mb-1">
                      Rate Driver Reputation
                    </span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          disabled={txStatus === "pending"}
                          onMouseEnter={() => setHoveredStars(prev => ({ ...prev, [ride.id]: star }))}
                          onMouseLeave={() => setHoveredStars(prev => ({ ...prev, [ride.id]: 0 }))}
                          onClick={() => handleRate(ride.id, star)}
                          className="p-1 focus:outline-none transition-transform active:scale-95 disabled:opacity-50"
                        >
                          <Star 
                            className={`w-5 h-5 transition-colors ${
                              star <= (hoveredStars[ride.id] || 0)
                                ? "text-amber-400 fill-amber-400"
                                : "text-zinc-700 hover:text-amber-400"
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-[10px] text-zinc-400 ml-2">Select 1-5 stars</span>
                    </div>
                  </div>
                )}

                {ride.status === 2 && ride.rating > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 bg-amber-950/20 border border-amber-500/15 p-2 rounded-lg text-amber-300 text-xs">
                    <Award className="w-4 h-4" />
                    <span>You rated this driver <span className="font-bold">{ride.rating}</span> stars</span>
                  </div>
                )}
              </div>
            ))
          )
        ) : (
          availableRidesForDrivers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <Car className="w-10 h-10 text-zinc-700 mb-2.5" />
              <h4 className="font-bold text-white text-sm">No Open Ride Requests</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                Check back in a moment or open another browser tab to request a ride.
              </p>
            </div>
          ) : (
            availableRidesForDrivers.map((ride) => (
              <div 
                key={ride.id}
                className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/20 hover:border-zinc-700/60 transition-all"
              >
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold">Ride ID</span>
                    <h5 className="font-bold text-white text-sm font-mono mt-0.5">#MR-{ride.id}</h5>
                  </div>
                  <span className="font-bold text-secondary bg-secondary/15 px-2.5 py-0.5 rounded-lg border border-secondary/20 text-xs">
                    {ride.fare} RIDE
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 py-2.5 border-y border-zinc-900 mb-4 text-xs">
                  <div>
                    <span className="text-zinc-500 uppercase block text-[9px] font-semibold">Passenger Address</span>
                    <span className="font-medium text-zinc-300 mt-1 block font-mono">
                      {formatAddress(ride.passenger)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase block text-[9px] font-semibold">Compensation</span>
                    <span className="font-medium text-emerald-400 mt-1 block">
                      +{ride.fare} RIDE (Post-Escrow)
                    </span>
                  </div>
                </div>

                <button
                  disabled={txStatus === "pending"}
                  onClick={() => acceptRide(ride.id)}
                  className="w-full py-2 bg-gradient-to-r from-secondary to-indigo-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-all shadow-md disabled:opacity-50"
                >
                  <Car className="w-3.5 h-3.5" /> Accept Ride & Start Trip
                </button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
