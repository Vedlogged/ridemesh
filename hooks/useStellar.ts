import { create } from "zustand";
import { 
  rpcServer, 
  getXLMBalance, 
  getTokenBalance, 
  buildTransaction, 
  pollTransaction, 
  CONTRACT_ID, 
  FARE_TOKEN_ID, 
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

export interface BlockchainEvent {
  id: string;
  type: "requested" | "accepted" | "completed" | "cancelled" | "rated";
  timestamp: number;
  walletAddress: string;
  details: string;
  hash: string;
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
  drivers: Record<string, DriverProfile>;
  events: BlockchainEvent[];
  
  // Loading & TX States
  txStatus: "idle" | "pending" | "success" | "failed";
  txHash: string | null;
  errorMessage: string | null;
  loadingStates: Record<string, boolean>; // Granular loader indicators (e.g. { 'request': true, 'accept-101': true })

  // Actions
  connectWallet: (sandbox?: boolean) => Promise<void>;
  disconnectWallet: () => void;
  loadBalances: () => Promise<void>;
  requestRide: (fare: number) => Promise<void>;
  acceptRide: (rideId: number) => Promise<void>;
  completeRide: (rideId: number) => Promise<void>;
  cancelRide: (rideId: number) => Promise<void>;
  rateDriver: (rideId: number, rating: number) => Promise<void>;
  clearError: () => void;
  pollBlockchainEvents: () => Promise<void>;
  loadDriverProfiles: () => Promise<void>;
  addEvent: (event: Omit<BlockchainEvent, "id">) => void;
  setLoading: (key: string, val: boolean) => void;
}

// Lazy dynamic importer for StellarWalletsKit to avoid SSR compilation errors
let isKitInitialized = false;

async function getWalletKit() {
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

// Initial mockup data for sandbox/fallback mode
const MOCK_RIDES: Ride[] = [
  {
    id: 101,
    passenger: "GD Passenger (GCPX...45LM)",
    driver: "GD Driver (GDRV...90PX)",
    fare: 15.5,
    status: 2, // Completed
    rating: 5,
    timestamp: Date.now() - 3600000 * 2, // 2 hours ago
    passengerName: "Alice Miller",
    driverName: "Robert Ford"
  },
  {
    id: 102,
    passenger: "GD Passenger (GCPX...45LM)",
    driver: "GD Driver (GDRV...90PX)",
    fare: 22.0,
    status: 1, // Accepted
    rating: 0,
    timestamp: Date.now() - 1800000, // 30 mins ago
    passengerName: "Alice Miller",
    driverName: "Robert Ford"
  },
  {
    id: 103,
    passenger: "GD Passenger (GCPX...45LM)",
    driver: "GD Passenger (GCPX...45LM)", // Placeholder
    fare: 8.5,
    status: 0, // Requested
    rating: 0,
    timestamp: Date.now() - 300000, // 5 mins ago
    passengerName: "Alice Miller",
    driverName: "Waiting for Driver"
  }
];

const MOCK_DRIVERS: Record<string, DriverProfile> = {
  "GDRV...90PX": {
    address: "GDRV...90PX",
    reputationScore: 48, // 4.8 stars
    totalRides: 42,
    ratingSum: 201
  }
};

const MOCK_EVENTS: BlockchainEvent[] = [
  {
    id: "evt_1",
    type: "requested",
    timestamp: Date.now() - 3600000 * 2.5,
    walletAddress: "GCPX...45LM",
    details: "Requested a ride for 15.5 RIDE tokens",
    hash: "6f89025e1a148a04b192809e51c8a14b302c0b5c1c8a815a1f28b4a5d8f6e72c"
  },
  {
    id: "evt_2",
    type: "accepted",
    timestamp: Date.now() - 3600000 * 2.4,
    walletAddress: "GDRV...90PX",
    details: "Accepted ride request #101",
    hash: "3a928e145b20cb88c1c46be091a18c6e2a149b5d120a1cf402da182a938fc289"
  },
  {
    id: "evt_3",
    type: "completed",
    timestamp: Date.now() - 3600000 * 2.0,
    walletAddress: "GCPX...45LM",
    details: "Confirmed completion of ride #101. Escrow released.",
    hash: "12ab34cd56ef789012ab34cd56ef789012ab34cd56ef789012ab34cd56ef7890"
  },
  {
    id: "evt_4",
    type: "rated",
    timestamp: Date.now() - 3600000 * 1.9,
    walletAddress: "GCPX...45LM",
    details: "Rated driver Robert Ford 5 stars for ride #101",
    hash: "56ef789012ab34cd56ef789012ab34cd56ef789012ab34cd56ef789012ab34cd"
  }
];

export const useStellar = create<StellarState>((set, get) => ({
  // Initial States
  walletAddress: null,
  isConnected: false,
  isConnecting: false,
  xlmBalance: "0.0",
  tokenBalance: "0.0",
  network: "Stellar Testnet",
  isSandbox: true, // Default to sandbox simulator until a real wallet connects
  rides: MOCK_RIDES,
  drivers: MOCK_DRIVERS,
  events: MOCK_EVENTS,
  txStatus: "idle",
  txHash: null,
  errorMessage: null,
  loadingStates: {},

  clearError: () => set({ errorMessage: null }),

  setLoading: (key, val) => set((state) => ({
    loadingStates: {
      ...state.loadingStates,
      [key]: val
    }
  })),

  addEvent: (event) => set((state) => ({
    events: [
      {
        ...event,
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      },
      ...state.events
    ]
  })),

  connectWallet: async (sandbox = false) => {
    set({ isConnecting: true, errorMessage: null });
    
    if (sandbox) {
      // Launch Sandbox Mode
      setTimeout(() => {
        set({
          walletAddress: "GD_SANDBOX_USER_PUBLIC_KEY_1234567890",
          isConnected: true,
          isConnecting: false,
          xlmBalance: "1000.0000",
          tokenBalance: "250.5000",
          isSandbox: true,
          txStatus: "idle"
        });
        get().addEvent({
          type: "requested",
          timestamp: Date.now(),
          walletAddress: "GD_SANDBOX_USER",
          details: "Connected to RideMesh Sandbox Simulator",
          hash: "sandbox_connection_hash"
        });
      }, 500);
      return;
    }

    try {
      const Kit = await getWalletKit();
      const { address } = await Kit.authModal();
      
      if (!address) {
        throw new Error("Unable to retrieve public key from wallet. User might have cancelled.");
      }

      set({
        walletAddress: address,
        isConnected: true,
        isConnecting: false,
        isSandbox: false,
        txStatus: "idle"
      });

      // Fetch balances
      await get().loadBalances();
      
      get().addEvent({
        type: "requested",
        timestamp: Date.now(),
        walletAddress: address,
        details: "Connected via Stellar Wallet",
        hash: `conn_${Date.now()}`
      });

      // Trigger initial contract syncing
      await get().pollBlockchainEvents();

    } catch (error) {
      const err = error as Error;
      console.error("Failed to connect wallet:", err);
      set({ 
        isConnecting: false, 
        errorMessage: err.message || "User dismissed wallet modal or connection failed" 
      });
    }
  },

  disconnectWallet: () => {
    const address = get().walletAddress;
    try {
      if (typeof window !== "undefined") {
        getWalletKit().then((Kit) => Kit.disconnect());
      }
    } catch (e) {
      console.warn("Error disconnecting wallet kit:", e);
    }
    set({
      walletAddress: null,
      isConnected: false,
      xlmBalance: "0.0",
      tokenBalance: "0.0",
      isSandbox: true, // Revert to sandbox
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
    if (!walletAddress) return;

    if (isSandbox) {
      return; // Keep simulated values in sandbox
    }

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
      // Simulate Sandbox Escrow Creation
      setTimeout(() => {
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
          timestamp: Date.now(),
          passengerName: "You (Passenger)",
          driverName: "Waiting for Driver..."
        };

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
        get().setLoading("request", false);
      }, 1500);
      return;
    }

    // --- Real Blockchain Smart Contract call ---
    try {
      const stroopsAmount = toStroops(fare);
      
      // 1. Build contract invocation
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

      // 2. Request user to sign with their wallet
      const Kit = await getWalletKit();
      const { signedTxXdr: signedXdr } = await Kit.signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: walletAddress
      });

      // 3. Submit transaction
      const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const submission = await rpcServer.sendTransaction(txObj);
      if (submission.status === "ERROR") {
        throw new Error(`Transaction submission error: ${JSON.stringify(submission.errorResult)}`);
      }

      set({ txHash: submission.hash });

      // 4. Poll transaction status
      await pollTransaction(submission.hash);
      
      // 5. Update state on success
      set({ txStatus: "success" });
      await get().loadBalances();
      await get().pollBlockchainEvents();

    } catch (error) {
      const err = error as Error;
      console.error("Smart contract execution failed:", err);
      set({ 
        txStatus: "failed", 
        errorMessage: err.message || "Smart contract transaction rejected or failed" 
      });
    } finally {
      get().setLoading("request", false);
    }
  },

  acceptRide: async (rideId: number) => {
    const { walletAddress, isSandbox, isConnected } = get();
    if (!isConnected || !walletAddress) {
      set({ errorMessage: "Please connect a wallet first" });
      return;
    }

    const loaderKey = `accept-${rideId}`;
    get().setLoading(loaderKey, true);
    set({ txStatus: "pending", txHash: null, errorMessage: null });

    const txSimHash = Math.random().toString(16).substring(2, 34);

    if (isSandbox) {
      // Simulate Sandbox Driver Acceptance
      setTimeout(() => {
        set((state) => ({
          rides: state.rides.map(r => r.id === rideId ? {
            ...r,
            driver: walletAddress,
            driverName: "You (Driver)",
            status: 1 // Accepted
          } : r),
          txStatus: "success",
          txHash: `sim_${txSimHash}`
        }));

        get().addEvent({
          type: "accepted",
          timestamp: Date.now(),
          walletAddress: walletAddress,
          details: `Accepted Ride #${rideId} as Driver. Heading to passenger.`,
          hash: `sim_${txSimHash}`
        });
        get().setLoading(loaderKey, false);
      }, 1200);
      return;
    }

    // --- Real Blockchain Smart Contract call ---
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
    } catch (error) {
      const err = error as Error;
      console.error("Accept ride failed:", err);
      set({ 
        txStatus: "failed", 
        errorMessage: err.message || "Accept ride transaction failed" 
      });
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
      // Simulate Sandbox Ride Completion
      setTimeout(() => {
        const targetRide = get().rides.find(r => r.id === rideId);
        if (!targetRide) {
          set({ txStatus: "failed", errorMessage: "Ride not found" });
          get().setLoading(loaderKey, false);
          return;
        }

        set((state) => ({
          rides: state.rides.map(r => r.id === rideId ? {
            ...r,
            status: 2 // Completed
          } : r),
          txStatus: "success",
          txHash: `sim_${txSimHash}`
        }));

        get().addEvent({
          type: "completed",
          timestamp: Date.now(),
          walletAddress: walletAddress,
          details: `Confirmed ride #${rideId} completed. Escrow of ${targetRide.fare} released.`,
          hash: `sim_${txSimHash}`
        });
        get().setLoading(loaderKey, false);
      }, 1200);
      return;
    }

    // --- Real Blockchain Smart Contract call ---
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
    } catch (error) {
      const err = error as Error;
      console.error("Complete ride failed:", err);
      set({ 
        txStatus: "failed", 
        errorMessage: err.message || "Complete ride transaction failed" 
      });
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
      // Simulate Sandbox Cancellation
      setTimeout(() => {
        const targetRide = get().rides.find(r => r.id === rideId);
        if (!targetRide) {
          set({ txStatus: "failed", errorMessage: "Ride not found" });
          get().setLoading(loaderKey, false);
          return;
        }

        const refund = targetRide.fare;
        const currentBalance = Number(get().tokenBalance);

        set((state) => ({
          rides: state.rides.map(r => r.id === rideId ? {
            ...r,
            status: 3 // Cancelled
          } : r),
          tokenBalance: (currentBalance + refund).toFixed(4),
          txStatus: "success",
          txHash: `sim_${txSimHash}`
        }));

        get().addEvent({
          type: "cancelled",
          timestamp: Date.now(),
          walletAddress: walletAddress,
          details: `Cancelled Ride #${rideId}. Escrow of ${refund} RIDE refunded.`,
          hash: `sim_${txSimHash}`
        });
        get().setLoading(loaderKey, false);
      }, 1200);
      return;
    }

    // --- Real Blockchain Smart Contract call ---
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
    } catch (error) {
      const err = error as Error;
      console.error("Cancel ride failed:", err);
      set({ 
        txStatus: "failed", 
        errorMessage: err.message || "Cancellation failed" 
      });
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
      // Simulate Sandbox Driver Rating
      setTimeout(() => {
        const targetRide = get().rides.find(r => r.id === rideId);
        if (!targetRide) {
          set({ txStatus: "failed", errorMessage: "Ride not found" });
          get().setLoading(loaderKey, false);
          return;
        }

        const driverKey = targetRide.driver === walletAddress ? "GDRV...90PX" : targetRide.driver;
        const driverProfile = get().drivers[driverKey] || {
          address: driverKey,
          reputationScore: 0,
          totalRides: 0,
          ratingSum: 0
        };

        const updatedDriver = {
          ...driverProfile,
          totalRides: driverProfile.totalRides + 1,
          ratingSum: driverProfile.ratingSum + rating,
          reputationScore: Math.round(((driverProfile.ratingSum + rating) * 10) / (driverProfile.totalRides + 1))
        };

        set((state) => ({
          rides: state.rides.map(r => r.id === rideId ? {
            ...r,
            rating
          } : r),
          drivers: {
            ...state.drivers,
            [driverKey]: updatedDriver
          },
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
        get().setLoading(loaderKey, false);
      }, 1000);
      return;
    }

    // --- Real Blockchain Smart Contract call ---
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
    } catch (error) {
      const err = error as Error;
      console.error("Rate driver failed:", err);
      set({ 
        txStatus: "failed", 
        errorMessage: err.message || "Submit rating transaction failed" 
      });
    } finally {
      get().setLoading(loaderKey, false);
    }
  },

  loadDriverProfiles: async () => {
    const { rides, isSandbox } = get();
    if (isSandbox) return;

    // Collect all unique driver addresses (excluding placeholders / passengers)
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
        // Query Reputation Contract data directly using the mock simulate call
        const result = await simulateCall(
          CONTRACT_ID, // Call RideMesh, which delegates call to Reputation
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
        drivers: {
          ...state.drivers,
          ...updatedDrivers
        }
      }));
    }
  },

  pollBlockchainEvents: async () => {
    const { isSandbox } = get();
    if (isSandbox) return; // Simulated sandbox environment handles its own local events

    try {
      const latestLedgerResp = await rpcServer.getLatestLedger();
      const startLedger = latestLedgerResp.sequence - 100; // Look back ~100 ledgers
      
      const eventResponse = await rpcServer.getEvents({
        startLedger,
        filters: [
          {
            type: "contract",
            contractIds: [CONTRACT_ID]
          }
        ],
        limit: 15
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

        // 1. Fetch newly discovered ride IDs that we don't have in local state
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
                    timestamp: Number(rideData.timestamp) * 1000 // Convert sec to ms
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

        // 2. Apply status & rating updates to existing rides
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

        // 3. Update driver profiles dynamically based on rated events
        await get().loadDriverProfiles();

        // 4. Merge and de-duplicate event log feed
        set((state) => {
          const merged = [...formattedEvents, ...state.events];
          const unique = merged.filter((item, index, self) =>
            index === self.findIndex((t) => t.id === item.id)
          );
          return { events: unique };
        });
      }
    } catch (e) {
      console.warn("Failed to poll live smart contract events:", e);
    }
  }
}));
