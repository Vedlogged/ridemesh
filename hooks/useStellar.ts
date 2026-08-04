/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { 
  rpcServer, 
  getXLMBalance, 
  getTokenBalance, 
  buildTransaction, 
  pollTransaction, 
  CONTRACT_ID, 
  FARE_TOKEN_ID, 
  REPUTATION_CONTRACT_ID,
  DRIVER_IDENTITY_CONTRACT_ID,
  NETWORK_PASSPHRASE,
  toStroops,
  fromStroops,
  simulateCall
} from "@/lib/stellar";
import { nativeToScVal, scValToNative, Address, TransactionBuilder } from "@stellar/stellar-sdk";

// Define TypeScript interfaces for our application state
export interface Ride {
  id: number;
  passenger: string;
  driver: string;
  fare: number;
  status: number; // 0 = Requested, 1 = Accepted, 2 = Completed, 3 = Cancelled
  rating: number; // 0 = Unrated, 1-5 = Rated
  timestamp: number;
  passengerName?: string;
  driverName?: string;
}

export interface DriverProfile {
  address: string;
  reputationScore: number; // Avg rating * 10
  totalRides: number;
  ratingSum: number;
}

export interface DriverIdentity {
  wallet: string;
  name: string;
  vehicleNumber: string;
  vehicleType: string;
  licenseHash: string;
  isVerified: boolean;
  registrationDate: number;
}

export interface BlockchainEvent {
  id: string;
  type: "requested" | "accepted" | "completed" | "cancelled" | "rated";
  timestamp: number;
  walletAddress: string;
  details: string;
  hash: string;
}

export interface AnalyticsMetrics {
  totalRides: number;
  completedRides: number;
  activeEscrows: number;
  cancelledRides: number;
  escrowVolumeTotal: number;
  escrowVolumeActive: number;
  escrowVolumeSettled: number;
  averageRating: number;
  dailyActiveUsers: number;
  totalDrivers: number;
}

export interface RegisteredDriver {
  wallet: string;
  name: string;
  vehicleNumber: string;
  vehicleType: string;
  licenseHash: string;
  isVerified: boolean;
  reputationScore: number;
  totalRides: number;
  ratingSum: number;
  registrationDate: number;
}

export interface UserFeedback {
  wallet: string;
  rating: number;
  comments: string;
  timestamp: number;
}

interface StellarState {
  // Wallet state
  walletAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  xlmBalance: string;
  tokenBalance: string;
  network: string;
  isSandbox: boolean; // True if using local simulator, False if real wallet
  
  // App state
  rides: Ride[];
  drivers: Record<string, DriverProfile>; // Map driver address -> reputation profile
  registeredDrivers: RegisteredDriver[]; // Full list from backend indexer
  driverProfile: DriverIdentity | null;  // Connect wallet's identity details
  analytics: AnalyticsMetrics | null;
  feedbacks: UserFeedback[];
  events: BlockchainEvent[];
  
  // Loading & TX States
  txStatus: "idle" | "pending" | "success" | "failed";
  txHash: string | null;
  errorMessage: string | null;
  loadingStates: Record<string, boolean>; // Granular loader indicators

  // Actions
  connectWallet: (sandbox?: boolean) => Promise<void>;
  disconnectWallet: () => void;
  loadBalances: () => Promise<void>;
  
  // Escrow actions
  requestRide: (fare: number) => Promise<void>;
  acceptRide: (rideId: number) => Promise<void>;
  completeRide: (rideId: number) => Promise<void>;
  cancelRide: (rideId: number) => Promise<void>;
  rateDriver: (rideId: number, rating: number) => Promise<void>;
  
  // Driver Identity actions
  registerDriver: (name: string, vehicleNum: string, vehicleType: string, licenseHash: string) => Promise<void>;
  verifyDriver: (driverAddress: string) => Promise<void>;
  updateVehicle: (vehicleNum: string, vehicleType: string) => Promise<void>;
  
  // Feedback actions (Level 4 compliance)
  submitFeedback: (rating: number, comments: string) => Promise<void>;
  fetchFeedbacks: () => Promise<void>;
  
  // Sync Actions
  fetchAnalytics: () => Promise<void>;
  fetchDrivers: () => Promise<void>;
  pollBlockchainEvents: () => Promise<void>;
  loadDriverProfiles: () => Promise<void>;
  
  clearError: () => void;
  addEvent: (event: Omit<BlockchainEvent, "id">) => void;
  setLoading: (key: string, val: boolean) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
let isKitInitialized = false;

async function getWalletKit(): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("StellarWalletsKit can only be loaded in the browser context.");
  }
  const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit");

  if (!isKitInitialized) {
    const { FreighterModule } = await import("@creit.tech/stellar-wallets-kit/modules/freighter");
    const { AlbedoModule } = await import("@creit.tech/stellar-wallets-kit/modules/albedo");
    const { xBullModule } = await import("@creit.tech/stellar-wallets-kit/modules/xbull");

    StellarWalletsKit.init({
      modules: [
        new FreighterModule(),
        new AlbedoModule(),
        new xBullModule()
      ]
    });
    isKitInitialized = true;
  }
  return StellarWalletsKit;
}

export const useStellar = create<StellarState>((set, get) => ({
  walletAddress: null,
  isConnected: false,
  isConnecting: false,
  xlmBalance: "0.0",
  tokenBalance: "0.0",
  network: "testnet",
  isSandbox: true,
  
  rides: [],
  drivers: {},
  registeredDrivers: [],
  driverProfile: null,
  analytics: null,
  feedbacks: [],
  events: [],
  
  txStatus: "idle",
  txHash: null,
  errorMessage: null,
  loadingStates: {},

  setLoading: (key: string, val: boolean) => {
    set((state) => ({
      loadingStates: { ...state.loadingStates, [key]: val }
    }));
  },

  clearError: () => set({ errorMessage: null, txStatus: "idle" }),

  addEvent: (evt: Omit<BlockchainEvent, "id">) => {
    const id = `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const fullEvent: BlockchainEvent = { ...evt, id };
    set((state) => ({
      events: [fullEvent, ...state.events].slice(0, 50) // Cap event history at 50
    }));
  },

  fetchAnalytics: async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics`);
      if (res.ok) {
        const data = await res.json();
        set({ analytics: data.metrics });
      }
    } catch (e) {
      console.warn("Failed to fetch backend analytics:", e);
    }
  },

  fetchFeedbacks: async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/feedback`);
      if (res.ok) {
        const list = await res.json();
        set({ feedbacks: list });
      }
    } catch (e) {
      console.warn("Failed to fetch backend feedback list:", e);
    }
  },

  submitFeedback: async (rating: number, comments: string) => {
    const { walletAddress } = get();
    if (!walletAddress) return;

    get().setLoading("feedback", true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          rating,
          comments
        })
      });
      if (res.ok) {
        await get().fetchFeedbacks();
        get().addEvent({
          type: "completed",
          timestamp: Date.now(),
          walletAddress,
          details: `Submitted app feedback rating: ${rating}/5 stars.`,
          hash: `fb_${Date.now()}`
        });
      }
    } catch (e) {
      console.warn("Failed to submit feedback:", e);
    } finally {
      get().setLoading("feedback", false);
    }
  },

  fetchDrivers: async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/drivers`);
      if (res.ok) {
        const list = await res.json();
        set({ registeredDrivers: list });
      }
    } catch (e) {
      console.warn("Failed to fetch backend drivers list:", e);
    }
  },

  connectWallet: async (sandbox = false) => {
    set({ isConnecting: true, errorMessage: null });
    
    if (sandbox) {
      setTimeout(async () => {
        const sandboxAddress = "GD_SANDBOX_USER_PUBLIC_KEY_1234567890";
        set({
          walletAddress: sandboxAddress,
          isConnected: true,
          isConnecting: false,
          isSandbox: true,
          xlmBalance: "1000.0000",
          tokenBalance: "250.5000",
          driverProfile: {
            wallet: sandboxAddress,
            name: "Sandbox Driver",
            vehicleNumber: "SBX-888",
            vehicleType: "Electric Cruiser",
            licenseHash: "mock_lic_hash_1",
            isVerified: true,
            registrationDate: Math.floor(Date.now() / 1000)
          }
        });

        // Query if registered in sandbox DB
        try {
          const res = await fetch(`${BACKEND_URL}/api/drivers`);
          if (res.ok) {
            const list: RegisteredDriver[] = await res.json();
            const profile = list.find(d => d.wallet === sandboxAddress);
            if (profile) {
              set({
                driverProfile: {
                  wallet: profile.wallet,
                  name: profile.name,
                  vehicleNumber: profile.vehicleNumber,
                  vehicleType: profile.vehicleType,
                  licenseHash: profile.licenseHash,
                  isVerified: profile.isVerified,
                  registrationDate: profile.registrationDate
                }
              });
            } else {
              set({ driverProfile: null });
            }
          }
        } catch (e) {
          console.warn("Failed to check sandbox driver registration:", e);
        }

        get().addEvent({
          type: "completed",
          timestamp: Date.now(),
          walletAddress: sandboxAddress,
          details: "Initialized Sandbox Simulator environment.",
          hash: "sandbox_gen_1"
        });

        // Seed some mock rides in sandbox for immediate visuals
        if (get().rides.length === 0) {
          set({
            rides: [
              {
                id: 101,
                passenger: "GD Passenger (GCPX...45LM)",
                driver: "GD Passenger (GCPX...45LM)",
                fare: 15.0,
                status: 0,
                rating: 0,
                timestamp: Date.now() - 360000,
                passengerName: "Alice Miller",
                driverName: "Waiting for Driver..."
              }
            ]
          });
        }

        await get().fetchAnalytics();
        await get().fetchDrivers();
        await get().fetchFeedbacks();
      }, 500);
      return;
    }

    // Real wallet connection flow (Freighter / Albedo / xBull)
    try {
      const Kit = await getWalletKit();
      // Triggers wallet options modal popup in browser
      const connection = await Kit.openModal({
        allowedWallets: ["freighter", "albedo", "xbull"],
        network: NETWORK_PASSPHRASE
      });

      if (!connection || !connection.address) {
        throw new Error("No wallet connected.");
      }

      set({
        walletAddress: connection.address,
        isConnected: true,
        isConnecting: false,
        isSandbox: false
      });

      get().addEvent({
        type: "completed",
        timestamp: Date.now(),
        walletAddress: connection.address,
        details: `Connected wallet: ${connection.name}`,
        hash: `conn_${Date.now()}`
      });

      // Challenge Response Session Registration
      try {
        await fetch(`${BACKEND_URL}/api/verify-wallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: connection.address })
        });
      } catch (e) {
        console.warn("Session verification request failed:", e);
      }

      // Check on-chain Driver Identity
      await get().loadBalances();
      await get().pollBlockchainEvents();
      await get().fetchAnalytics();
      await get().fetchDrivers();
      await get().fetchFeedbacks();
      
      // Load current driver profile
      try {
        const result = await simulateCall(
          DRIVER_IDENTITY_CONTRACT_ID,
          "get_driver",
          [nativeToScVal(Address.fromString(connection.address))]
        );
        if (result) {
          const profile = scValToNative(result);
          if (profile) {
            set({
              driverProfile: {
                wallet: connection.address,
                name: profile.name,
                vehicleNumber: profile.vehicle_number,
                vehicleType: profile.vehicle_type,
                licenseHash: profile.license_hash,
                isVerified: profile.is_verified,
                registrationDate: Number(profile.registration_date)
              }
            });
          }
        }
      } catch (err) {
        console.warn("Failed to retrieve driver profile from chain:", err);
      }

    } catch (error) {
      const err = error as Error;
      console.error("Wallet connection failed:", err);
      set({ 
        isConnecting: false, 
        isConnected: false, 
        errorMessage: err.message || "Failed to establish secure wallet connection" 
      });
    }
  },

  disconnectWallet: () => {
    const address = get().walletAddress;
    set({
      walletAddress: null,
      isConnected: false,
      isSandbox: true,
      driverProfile: null,
      txStatus: "idle",
      txHash: null,
      errorMessage: null,
      loadingStates: {}
    });
    
    get().addEvent({
      type: "cancelled",
      timestamp: Date.now(),
      walletAddress: address || "System",
      details: "Disconnected wallet.",
      hash: `disc_${Date.now()}`
    });
  },

  loadBalances: async () => {
    const { walletAddress, isSandbox } = get();
    if (!walletAddress || isSandbox) return;

    try {
      const xlm = await getXLMBalance(walletAddress);
      const token = await getTokenBalance(walletAddress, FARE_TOKEN_ID);
      set({ xlmBalance: xlm, tokenBalance: token });
    } catch (e) {
      console.error("Failed to load balances:", e);
    }
  },

  requestRide: async (fare: number) => {
    const { walletAddress, isSandbox, isConnected } = get();
    if (!isConnected || !walletAddress) {
      set({ errorMessage: "Please connect a wallet first" });
      return;
    }

    get().setLoading("request", true);
    set({ txStatus: "pending", txHash: null, errorMessage: null });

    const txSimHash = Math.random().toString(16).substring(2, 34);

    if (isSandbox) {
      setTimeout(async () => {
        const rideVal = Number(get().tokenBalance);
        if (rideVal < fare) {
          set({ 
            txStatus: "failed", 
            errorMessage: "Insufficient balance: You do not have enough RIDE tokens for this fare escrow" 
          });
          get().setLoading("request", false);
          return;
        }

        const newRide: Ride = {
          id: Math.floor(Math.random() * 1000) + 200,
          passenger: walletAddress,
          driver: walletAddress, // placeholder
          fare,
          status: 0, // Requested
          rating: 0,
          timestamp: Math.floor(Date.now() / 1000),
          passengerName: "You (Passenger)",
          driverName: "Waiting for Driver..."
        };

        // Sync with backend API
        try {
          await fetch(`${BACKEND_URL}/api/sandbox/rides`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRide)
          });
        } catch (e) {
          console.warn("Failed to sync sandbox ride with backend:", e);
        }

        set((state) => ({
          rides: [newRide, ...state.rides],
          tokenBalance: (rideVal - fare).toFixed(4),
          txStatus: "success",
          txHash: `sim_${txSimHash}`
        }));

        get().addEvent({
          type: "requested",
          timestamp: Date.now(),
          walletAddress: walletAddress,
          details: `Requested a new RideMesh ride. Escrowed ${fare} RIDE tokens.`,
          hash: `sim_${txSimHash}`
        });

        await get().fetchAnalytics();
        get().setLoading("request", false);
      }, 1500);
      return;
    }

    // Real Stellar Testnet transaction call
    try {
      const stroopsAmount = toStroops(fare);
      const tx = await buildTransaction(
        walletAddress,
        CONTRACT_ID,
        "request_ride",
        [
          nativeToScVal(Address.fromString(walletAddress)),
          nativeToScVal(Address.fromString(FARE_TOKEN_ID)),
          nativeToScVal(stroopsAmount, { type: "i128" })
        ]
      );

      const Kit = await getWalletKit();
      const { signedTxXdr: signedXdr } = await Kit.signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: walletAddress
      });

      const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const submission = await rpcServer.sendTransaction(txObj);
      if (submission.status === "ERROR") {
        throw new Error(`Transaction submission error: ${JSON.stringify(submission.errorResult)}`);
      }

      set({ txHash: submission.hash });
      await pollTransaction(submission.hash);
      set({ txStatus: "success" });
      
      await get().loadBalances();
      await get().pollBlockchainEvents();
      await get().fetchAnalytics();
    } catch (error) {
      const err = error as Error;
      set({ 
        txStatus: "failed", 
        errorMessage: err.message || "Smart contract transaction rejected or failed" 
      });
    } finally {
      get().setLoading("request", false);
    }
  },

  acceptRide: async (rideId: number) => {
    const { walletAddress, isSandbox, isConnected, driverProfile } = get();
    if (!isConnected || !walletAddress) {
      set({ errorMessage: "Please connect a wallet first" });
      return;
    }

    // Safety check: is registered driver?
    if (!driverProfile) {
      set({ errorMessage: "You must register a driver profile in the Driver Hub first!" });
      return;
    }
    if (!driverProfile.isVerified) {
      set({ errorMessage: "Your driver registry profile is pending Administrator verification." });
      return;
    }

    const loaderKey = `accept-${rideId}`;
    get().setLoading(loaderKey, true);
    set({ txStatus: "pending", txHash: null, errorMessage: null });

    const txSimHash = Math.random().toString(16).substring(2, 34);

    if (isSandbox) {
      setTimeout(async () => {
        const ride = get().rides.find(r => r.id === rideId);
        if (!ride) {
          set({ txStatus: "failed", errorMessage: "Ride not found" });
          get().setLoading(loaderKey, false);
          return;
        }

        const updatedRide = {
          ...ride,
          driver: walletAddress,
          driverName: "You (Driver)",
          status: 1 // Accepted
        };

        // Sync with backend API
        try {
          await fetch(`${BACKEND_URL}/api/sandbox/rides`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedRide)
          });
        } catch (e) {
          console.warn("Failed to sync sandbox accept ride status:", e);
        }

        set((state) => ({
          rides: state.rides.map(r => r.id === rideId ? updatedRide : r),
          txStatus: "success",
          txHash: `sim_${txSimHash}`
        }));

        get().addEvent({
          type: "accepted",
          timestamp: Date.now(),
          walletAddress: walletAddress,
          details: `Accepted Ride #${rideId} as Driver. Trip started.`,
          hash: `sim_${txSimHash}`
        });

        await get().fetchAnalytics();
        get().setLoading(loaderKey, false);
      }, 1200);
      return;
    }

    // Real Stellar Testnet transaction call
    try {
      const tx = await buildTransaction(
        walletAddress,
        CONTRACT_ID,
        "accept_ride",
        [
          nativeToScVal(rideId, { type: "u32" }),
          nativeToScVal(Address.fromString(walletAddress))
        ]
      );

      const Kit = await getWalletKit();
      const { signedTxXdr: signedXdr } = await Kit.signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: walletAddress
      });

      const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const submission = await rpcServer.sendTransaction(txObj);
      set({ txHash: submission.hash });
      await pollTransaction(submission.hash);
      
      set({ txStatus: "success" });
      await get().pollBlockchainEvents();
      await get().fetchAnalytics();
    } catch (error) {
      const err = error as Error;
      set({ txStatus: "failed", errorMessage: err.message || "Accept ride transaction failed" });
    } finally {
      get().setLoading(loaderKey, false);
    }
  },

  completeRide: async (rideId: number) => {
    const { walletAddress, isSandbox, isConnected } = get();
    if (!isConnected || !walletAddress) {
      set({ errorMessage: "Please connect a wallet first" });
      return;
    }

    const loaderKey = `complete-${rideId}`;
    get().setLoading(loaderKey, true);
    set({ txStatus: "pending", txHash: null, errorMessage: null });

    const txSimHash = Math.random().toString(16).substring(2, 34);

    if (isSandbox) {
      setTimeout(async () => {
        const ride = get().rides.find(r => r.id === rideId);
        if (!ride) {
          set({ txStatus: "failed", errorMessage: "Ride not found" });
          get().setLoading(loaderKey, false);
          return;
        }

        const updatedRide = {
          ...ride,
          status: 2 // Completed
        };

        // Sync with backend API
        try {
          await fetch(`${BACKEND_URL}/api/sandbox/rides`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedRide)
          });
        } catch (e) {
          console.warn("Failed to sync completed ride:", e);
        }

        set((state) => ({
          rides: state.rides.map(r => r.id === rideId ? updatedRide : r),
          txStatus: "success",
          txHash: `sim_${txSimHash}`
        }));

        get().addEvent({
          type: "completed",
          timestamp: Date.now(),
          walletAddress: walletAddress,
          details: `Passenger confirmed ride #${rideId} finished. Payment released to Driver.`,
          hash: `sim_${txSimHash}`
        });

        await get().fetchAnalytics();
        get().setLoading(loaderKey, false);
      }, 1200);
      return;
    }

    // Real Stellar Testnet transaction call
    try {
      const tx = await buildTransaction(
        walletAddress,
        CONTRACT_ID,
        "complete_ride",
        [
          nativeToScVal(rideId, { type: "u32" }),
          nativeToScVal(Address.fromString(FARE_TOKEN_ID))
        ]
      );

      const Kit = await getWalletKit();
      const { signedTxXdr: signedXdr } = await Kit.signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: walletAddress
      });

      const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const submission = await rpcServer.sendTransaction(txObj);
      set({ txHash: submission.hash });
      await pollTransaction(submission.hash);
      
      set({ txStatus: "success" });
      await get().loadBalances();
      await get().pollBlockchainEvents();
      await get().fetchAnalytics();
    } catch (error) {
      const err = error as Error;
      set({ txStatus: "failed", errorMessage: err.message || "Complete ride transaction failed" });
    } finally {
      get().setLoading(loaderKey, false);
    }
  },

  cancelRide: async (rideId: number) => {
    const { walletAddress, isSandbox, isConnected } = get();
    if (!isConnected || !walletAddress) {
      set({ errorMessage: "Please connect a wallet first" });
      return;
    }

    const loaderKey = `cancel-${rideId}`;
    get().setLoading(loaderKey, true);
    set({ txStatus: "pending", txHash: null, errorMessage: null });

    const txSimHash = Math.random().toString(16).substring(2, 34);

    if (isSandbox) {
      setTimeout(async () => {
        const ride = get().rides.find(r => r.id === rideId);
        if (!ride) {
          set({ txStatus: "failed", errorMessage: "Ride not found" });
          get().setLoading(loaderKey, false);
          return;
        }

        const refund = ride.fare;
        const currentBalance = Number(get().tokenBalance);

        const updatedRide = {
          ...ride,
          status: 3 // Cancelled
        };

        // Sync with backend API
        try {
          await fetch(`${BACKEND_URL}/api/sandbox/rides`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedRide)
          });
        } catch (e) {
          console.warn("Failed to sync cancelled ride status:", e);
        }

        set((state) => ({
          rides: state.rides.map(r => r.id === rideId ? updatedRide : r),
          tokenBalance: (currentBalance + refund).toFixed(4),
          txStatus: "success",
          txHash: `sim_${txSimHash}`
        }));

        get().addEvent({
          type: "cancelled",
          timestamp: Date.now(),
          walletAddress: walletAddress,
          details: `Cancelled Ride #${rideId}. Fare of ${refund} RIDE refunded to passenger.`,
          hash: `sim_${txSimHash}`
        });

        await get().fetchAnalytics();
        get().setLoading(loaderKey, false);
      }, 1200);
      return;
    }

    // Real Stellar Testnet transaction call
    try {
      const tx = await buildTransaction(
        walletAddress,
        CONTRACT_ID,
        "cancel_ride",
        [
          nativeToScVal(rideId, { type: "u32" }),
          nativeToScVal(Address.fromString(FARE_TOKEN_ID)),
          nativeToScVal(Address.fromString(walletAddress))
        ]
      );

      const Kit = await getWalletKit();
      const { signedTxXdr: signedXdr } = await Kit.signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: walletAddress
      });

      const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const submission = await rpcServer.sendTransaction(txObj);
      set({ txHash: submission.hash });
      await pollTransaction(submission.hash);
      
      set({ txStatus: "success" });
      await get().loadBalances();
      await get().pollBlockchainEvents();
      await get().fetchAnalytics();
    } catch (error) {
      const err = error as Error;
      set({ txStatus: "failed", errorMessage: err.message || "Cancellation failed" });
    } finally {
      get().setLoading(loaderKey, false);
    }
  },

  rateDriver: async (rideId: number, rating: number) => {
    const { walletAddress, isSandbox, isConnected } = get();
    if (!isConnected || !walletAddress) {
      set({ errorMessage: "Please connect a wallet first" });
      return;
    }

    const loaderKey = `rate-${rideId}`;
    get().setLoading(loaderKey, true);
    set({ txStatus: "pending", txHash: null, errorMessage: null });

    const txSimHash = Math.random().toString(16).substring(2, 34);

    if (isSandbox) {
      setTimeout(async () => {
        const ride = get().rides.find(r => r.id === rideId);
        if (!ride) {
          set({ txStatus: "failed", errorMessage: "Ride not found" });
          get().setLoading(loaderKey, false);
          return;
        }

        const driverKey = ride.driver;
        const updatedRide = {
          ...ride,
          rating
        };

        // Sync with backend API
        try {
          await fetch(`${BACKEND_URL}/api/sandbox/rides`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedRide)
          });
        } catch (e) {
          console.warn("Failed to sync rating in sandbox:", e);
        }

        set((state) => ({
          rides: state.rides.map(r => r.id === rideId ? updatedRide : r),
          txStatus: "success",
          txHash: `sim_${txSimHash}`
        }));

        get().addEvent({
          type: "rated",
          timestamp: Date.now(),
          walletAddress: walletAddress,
          details: `Rated Driver ${rating} stars for Ride #${rideId}`,
          hash: `sim_${txSimHash}`
        });

        await get().fetchAnalytics();
        await get().fetchDrivers();
        get().setLoading(loaderKey, false);
      }, 1000);
      return;
    }

    // Real Stellar Testnet transaction call
    try {
      const tx = await buildTransaction(
        walletAddress,
        CONTRACT_ID,
        "rate_driver",
        [
          nativeToScVal(rideId, { type: "u32" }),
          nativeToScVal(rating, { type: "u32" })
        ]
      );

      const Kit = await getWalletKit();
      const { signedTxXdr: signedXdr } = await Kit.signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: walletAddress
      });

      const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const submission = await rpcServer.sendTransaction(txObj);
      set({ txHash: submission.hash });
      await pollTransaction(submission.hash);
      
      set({ txStatus: "success" });
      await get().pollBlockchainEvents();
      await get().fetchAnalytics();
      await get().fetchDrivers();
    } catch (error) {
      const err = error as Error;
      set({ txStatus: "failed", errorMessage: err.message || "Submit rating transaction failed" });
    } finally {
      get().setLoading(loaderKey, false);
    }
  },

  registerDriver: async (name: string, vehicleNum: string, vehicleType: string, licenseHash: string) => {
    const { walletAddress, isSandbox, isConnected } = get();
    if (!isConnected || !walletAddress) {
      set({ errorMessage: "Please connect a wallet first" });
      return;
    }

    get().setLoading("register-driver", true);
    set({ txStatus: "pending", txHash: null, errorMessage: null });

    const txSimHash = Math.random().toString(16).substring(2, 34);

    if (isSandbox) {
      setTimeout(async () => {
        const profile: DriverIdentity = {
          wallet: walletAddress,
          name,
          vehicleNumber: vehicleNum,
          vehicleType,
          licenseHash,
          isVerified: false, // Starts unverified, requires admin click
          registrationDate: Math.floor(Date.now() / 1000)
        };

        const backendDriver = {
          ...profile,
          reputationScore: 0,
          totalRides: 0,
          ratingSum: 0
        };

        // Sync with backend API
        try {
          await fetch(`${BACKEND_URL}/api/sandbox/drivers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(backendDriver)
          });
        } catch (e) {
          console.warn("Failed to sync driver registration in sandbox:", e);
        }

        set({
          driverProfile: profile,
          txStatus: "success",
          txHash: `sim_${txSimHash}`
        });

        get().addEvent({
          type: "completed",
          timestamp: Date.now(),
          walletAddress: walletAddress,
          details: `Registered Driver Identity for ${name} (${vehicleType}). Pending admin verification.`,
          hash: `sim_${txSimHash}`
        });

        await get().fetchAnalytics();
        await get().fetchDrivers();
        get().setLoading("register-driver", false);
      }, 1500);
      return;
    }

    // Real Stellar Testnet transaction call
    try {
      const tx = await buildTransaction(
        walletAddress,
        DRIVER_IDENTITY_CONTRACT_ID,
        "register_driver",
        [
          nativeToScVal(Address.fromString(walletAddress)),
          nativeToScVal(name, { type: "string" }),
          nativeToScVal(vehicleNum, { type: "string" }),
          nativeToScVal(vehicleType, { type: "string" }),
          nativeToScVal(licenseHash, { type: "string" })
        ]
      );

      const Kit = await getWalletKit();
      const { signedTxXdr: signedXdr } = await Kit.signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: walletAddress
      });

      const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const submission = await rpcServer.sendTransaction(txObj);
      set({ txHash: submission.hash });
      await pollTransaction(submission.hash);

      set({
        driverProfile: {
          wallet: walletAddress,
          name,
          vehicleNumber: vehicleNum,
          vehicleType,
          licenseHash,
          isVerified: false,
          registrationDate: Math.floor(Date.now() / 1000)
        },
        txStatus: "success"
      });

      await get().pollBlockchainEvents();
      await get().fetchDrivers();
    } catch (error) {
      const err = error as Error;
      set({ txStatus: "failed", errorMessage: err.message || "Driver registration contract call failed" });
    } finally {
      get().setLoading("register-driver", false);
    }
  },

  verifyDriver: async (driverAddress: string) => {
    const { walletAddress, isSandbox, isConnected } = get();
    if (!isConnected || !walletAddress) {
      set({ errorMessage: "Please connect a wallet first" });
      return;
    }

    const loaderKey = `verify-${driverAddress}`;
    get().setLoading(loaderKey, true);
    set({ txStatus: "pending", txHash: null, errorMessage: null });

    const txSimHash = Math.random().toString(16).substring(2, 34);

    if (isSandbox) {
      setTimeout(async () => {
        try {
          await fetch(`${BACKEND_URL}/api/sandbox/drivers/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: driverAddress })
          });
        } catch (e) {
          console.warn("Failed to sync driver verification:", e);
        }

        // If verifying ourself, update local profile status
        if (driverAddress === walletAddress && get().driverProfile) {
          set({
            driverProfile: {
              ...get().driverProfile!,
              isVerified: true
            }
          });
        }

        set({ txStatus: "success", txHash: `sim_${txSimHash}` });

        get().addEvent({
          type: "completed",
          timestamp: Date.now(),
          walletAddress: walletAddress,
          details: `Administrator verified driver wallet: ${driverAddress}`,
          hash: `sim_${txSimHash}`
        });

        await get().fetchAnalytics();
        await get().fetchDrivers();
        get().setLoading(loaderKey, false);
      }, 1000);
      return;
    }

    // Real Stellar Testnet transaction call
    try {
      const tx = await buildTransaction(
        walletAddress,
        DRIVER_IDENTITY_CONTRACT_ID,
        "verify_driver",
        [
          nativeToScVal(Address.fromString(walletAddress)), // Admin caller
          nativeToScVal(Address.fromString(driverAddress))  // Target driver
        ]
      );

      const Kit = await getWalletKit();
      const { signedTxXdr: signedXdr } = await Kit.signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: walletAddress
      });

      const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const submission = await rpcServer.sendTransaction(txObj);
      set({ txHash: submission.hash });
      await pollTransaction(submission.hash);

      if (driverAddress === walletAddress && get().driverProfile) {
        set({
          driverProfile: {
            ...get().driverProfile!,
            isVerified: true
          }
        });
      }

      set({ txStatus: "success" });
      await get().pollBlockchainEvents();
      await get().fetchDrivers();
    } catch (error) {
      const err = error as Error;
      set({ txStatus: "failed", errorMessage: err.message || "Driver verification contract call failed" });
    } finally {
      get().setLoading(loaderKey, false);
    }
  },

  updateVehicle: async (vehicleNum: string, vehicleType: string) => {
    const { walletAddress, isSandbox, isConnected, driverProfile } = get();
    if (!isConnected || !walletAddress || !driverProfile) {
      set({ errorMessage: "No active registered driver profile found" });
      return;
    }

    get().setLoading("update-vehicle", true);
    set({ txStatus: "pending", txHash: null, errorMessage: null });

    const txSimHash = Math.random().toString(16).substring(2, 34);

    if (isSandbox) {
      setTimeout(async () => {
        const updated = {
          ...driverProfile,
          vehicleNumber: vehicleNum,
          vehicleType
        };

        const backendDriver = {
          ...updated,
          reputationScore: 0,
          totalRides: 0,
          ratingSum: 0
        };

        try {
          await fetch(`${BACKEND_URL}/api/sandbox/drivers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(backendDriver)
          });
        } catch (e) {
          console.warn("Failed to sync driver vehicle update:", e);
        }

        set({
          driverProfile: updated,
          txStatus: "success",
          txHash: `sim_${txSimHash}`
        });

        get().addEvent({
          type: "completed",
          timestamp: Date.now(),
          walletAddress: walletAddress,
          details: `Updated vehicle to: ${vehicleType} (${vehicleNum})`,
          hash: `sim_${txSimHash}`
        });

        await get().fetchDrivers();
        get().setLoading("update-vehicle", false);
      }, 1200);
      return;
    }

    // Real Stellar Testnet transaction call
    try {
      const tx = await buildTransaction(
        walletAddress,
        DRIVER_IDENTITY_CONTRACT_ID,
        "update_vehicle",
        [
          nativeToScVal(Address.fromString(walletAddress)),
          nativeToScVal(vehicleNum, { type: "string" }),
          nativeToScVal(vehicleType, { type: "string" })
        ]
      );

      const Kit = await getWalletKit();
      const { signedTxXdr: signedXdr } = await Kit.signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: walletAddress
      });

      const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const submission = await rpcServer.sendTransaction(txObj);
      set({ txHash: submission.hash });
      await pollTransaction(submission.hash);

      set({
        driverProfile: {
          ...driverProfile,
          vehicleNumber: vehicleNum,
          vehicleType
        },
        txStatus: "success"
      });

      await get().pollBlockchainEvents();
      await get().fetchDrivers();
    } catch (error) {
      const err = error as Error;
      set({ txStatus: "failed", errorMessage: err.message || "Failed to update vehicle details in contract" });
    } finally {
      get().setLoading("update-vehicle", false);
    }
  },

  loadDriverProfiles: async () => {
    const { rides, isSandbox } = get();
    if (isSandbox) return;

    const uniqueDrivers = Array.from(
      new Set(
        rides
          .filter(r => r.status !== 0 && r.driver && r.driver !== r.passenger)
          .map(r => r.driver)
      )
    );

    const updatedDrivers: Record<string, DriverProfile> = {};

    for (const driverAddress of uniqueDrivers) {
      try {
        const result = await simulateCall(
          CONTRACT_ID,
          "get_driver",
          [nativeToScVal(Address.fromString(driverAddress))]
        );
        if (result) {
          const native = scValToNative(result);
          if (native) {
            updatedDrivers[driverAddress] = {
              address: driverAddress,
              reputationScore: Number(native.reputation_score),
              totalRides: Number(native.total_rides),
              ratingSum: Number(native.rating_sum)
            };
          }
        }
      } catch (e) {
        console.warn(`Failed to fetch on-chain profile for driver ${driverAddress}:`, e);
      }
    }

    if (Object.keys(updatedDrivers).length > 0) {
      set((state) => ({
        drivers: { ...state.drivers, ...updatedDrivers }
      }));
    }
  },

  pollBlockchainEvents: async () => {
    const { isSandbox } = get();
    if (isSandbox) return;

    try {
      const latestLedgerResp = await rpcServer.getLatestLedger();
      const startLedger = latestLedgerResp.sequence - 50; // Poll last 50 ledgers
      
      const eventResponse = await rpcServer.getEvents({
        startLedger,
        filters: [
          {
            type: "contract",
            contractIds: [CONTRACT_ID]
          }
        ],
        limit: 20
      });

      if (eventResponse.events && eventResponse.events.length > 0) {
        const updatedRidesMap = new Map<number, Partial<Ride>>();
        const newRideIdsToFetch: number[] = [];

        const formattedEvents = eventResponse.events.map((evt) => {
          const topics = evt.topic;
          const eventSymbol = scValToNative(topics[0]) as string;
          const address = scValToNative(topics[1]) as string;
          const rideId = topics[2] ? (scValToNative(topics[2]) as number) : 0;
          const value = scValToNative(evt.value);

          let type: BlockchainEvent["type"] = "requested";
          let details = "";

          if (rideId > 0) {
            if (eventSymbol === "ride_req") {
              type = "requested";
              details = `Passenger requested ride #${rideId} for ${fromStroops(value).toFixed(2)} RIDE`;
              newRideIdsToFetch.push(rideId);
            } else if (eventSymbol === "ride_acc") {
              type = "accepted";
              details = `Driver ${address.substring(0, 6)}... accepted ride #${rideId}`;
              updatedRidesMap.set(rideId, { status: 1, driver: address });
            } else if (eventSymbol === "ride_comp") {
              type = "completed";
              details = `Confirmed ride #${rideId} completed. Escrow released.`;
              updatedRidesMap.set(rideId, { status: 2 });
            } else if (eventSymbol === "ride_canc") {
              type = "cancelled";
              details = `Ride #${rideId} was cancelled. Escrow refunded.`;
              updatedRidesMap.set(rideId, { status: 3 });
            } else if (eventSymbol === "driver_rt") {
              type = "rated";
              details = `Driver rated ${value} stars for ride #${rideId}`;
              updatedRidesMap.set(rideId, { rating: Number(value) });
            }
          }

          return {
            id: evt.id,
            type,
            timestamp: Date.now(),
            walletAddress: address,
            details,
            hash: evt.txHash
          } as BlockchainEvent;
        });

        // Fetch newly discovered rides
        const currentRides = get().rides;
        const currentRideIds = new Set(currentRides.map(r => r.id));

        for (const rId of newRideIdsToFetch) {
          if (!currentRideIds.has(rId)) {
            try {
              const result = await simulateCall(
                CONTRACT_ID,
                "get_ride",
                [nativeToScVal(rId, { type: "u32" })]
              );
              if (result) {
                const rideData = scValToNative(result);
                if (rideData) {
                  const rideObj: Ride = {
                    id: Number(rideData.id),
                    passenger: rideData.passenger,
                    driver: rideData.driver,
                    fare: fromStroops(rideData.fare),
                    status: Number(rideData.status),
                    rating: Number(rideData.rating),
                    timestamp: Number(rideData.timestamp) * 1000
                  };
                  set((state) => ({
                    rides: [rideObj, ...state.rides]
                  }));
                }
              }
            } catch (err) {
              console.warn(`Failed to fetch new ride #${rId}:`, err);
            }
          }
        }

        // Apply status and ratings updates
        if (updatedRidesMap.size > 0) {
          set((state) => ({
            rides: state.rides.map(r => {
              const update = updatedRidesMap.get(r.id);
              if (update) {
                return { ...r, ...update };
              }
              return r;
            })
          }));
        }

        await get().loadDriverProfiles();

        // Merge event logs
        set((state) => {
          const merged = [...formattedEvents, ...state.events];
          const unique = merged.filter((item, index, self) =>
            index === self.findIndex((t) => t.id === item.id)
          );
          return { events: unique.slice(0, 50) };
        });
      }
    } catch (e) {
      console.warn("Failed to poll live smart contract events:", e);
    }
  }
}));
