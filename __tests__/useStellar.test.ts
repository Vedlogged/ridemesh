import { describe, it, expect, beforeEach } from "vitest";
import { useStellar } from "@/hooks/useStellar";

describe("useStellar Zustand Store Tests", () => {
  beforeEach(() => {
    // Reset store state by disconnecting
    const { disconnectWallet } = useStellar.getState();
    disconnectWallet();
  });

  it("should initialize with default disconnected sandbox state", () => {
    const state = useStellar.getState();
    expect(state.isConnected).toBe(false);
    expect(state.walletAddress).toBeNull();
    expect(state.isSandbox).toBe(true);
    expect(state.txStatus).toBe("idle");
  });

  it("should successfully connect to sandbox simulator and update user state", async () => {
    const { connectWallet } = useStellar.getState();
    
    await connectWallet(true);

    // Wait for mock connect timeout of 500ms
    await new Promise((resolve) => setTimeout(resolve, 600));

    const state = useStellar.getState();
    expect(state.isConnected).toBe(true);
    expect(state.walletAddress).toBe("GD_SANDBOX_USER_PUBLIC_KEY_1234567890");
    expect(state.isSandbox).toBe(true);
    expect(state.xlmBalance).toBe("1000.0000");
    expect(state.tokenBalance).toBe("250.5000");
  });

  it("should request a ride in sandbox, lock escrow, and update RIDE balance", async () => {
    const { connectWallet, requestRide } = useStellar.getState();
    
    await connectWallet(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Request ride of 20.5 tokens
    await requestRide(20.5);

    // Wait for mock request timeout of 1500ms
    await new Promise((resolve) => setTimeout(resolve, 1600));

    const state = useStellar.getState();
    expect(state.txStatus).toBe("success");
    expect(state.errorMessage).toBeNull();
    // Verify ride is created in local state
    expect(state.rides.length).toBeGreaterThan(0);
    expect(state.rides[0].fare).toBe(20.5);
    expect(state.rides[0].status).toBe(0); // Requested
    // Balance check: 250.5000 - 20.5 = 230.0000 RIDE tokens
    expect(state.tokenBalance).toBe("230.0000");
  });

  it("should fail requestRide if user balance is insufficient", async () => {
    const { connectWallet, requestRide } = useStellar.getState();
    
    await connectWallet(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Request ride of 350 tokens (sandbox start balance is 250.5)
    await requestRide(350.0);

    // Wait for mock request timeout
    await new Promise((resolve) => setTimeout(resolve, 1600));

    const state = useStellar.getState();
    expect(state.txStatus).toBe("failed");
    expect(state.errorMessage).toContain("Insufficient balance");
  });

  it("should allow a driver to accept a requested ride", async () => {
    const { connectWallet, acceptRide } = useStellar.getState();
    
    await connectWallet(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Mock an active requested ride in the state
    useStellar.setState((state) => ({
      rides: [
        {
          id: 999,
          passenger: "GD Passenger (GCPX...45LM)",
          driver: "GD Passenger (GCPX...45LM)",
          fare: 10.0,
          status: 0, // Requested
          rating: 0,
          timestamp: Date.now()
        },
        ...state.rides
      ]
    }));

    // Accept ride #999
    await acceptRide(999);

    // Wait for mock accept timeout of 1200ms
    await new Promise((resolve) => setTimeout(resolve, 1300));

    const state = useStellar.getState();
    const acceptedRide = state.rides.find((r) => r.id === 999);
    expect(acceptedRide).toBeDefined();
    expect(acceptedRide?.status).toBe(1); // Accepted / In Progress
    expect(acceptedRide?.driver).toBe("GD_SANDBOX_USER_PUBLIC_KEY_1234567890");
  });
});
