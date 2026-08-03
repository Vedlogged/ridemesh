import { Router, Request, Response } from "express";
import { Database, IRide, IDriver } from "../models/models";
import { NotificationService } from "../services/notifications";

const router = Router();

// GET /api/rides - Retrieve all rides
router.get("/rides", async (req: Request, res: Response) => {
  try {
    const rides = await Database.getRides();
    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

// GET /api/drivers - Retrieve all registered drivers
router.get("/drivers", async (req: Request, res: Response) => {
  try {
    const drivers = await Database.getDrivers();
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

// GET /api/analytics - Aggregate and return platform statistics
router.get("/analytics", async (req: Request, res: Response) => {
  try {
    const rides = await Database.getRides();
    const drivers = await Database.getDrivers();

    const totalRidesCount = rides.length;
    const completedRides = rides.filter(r => r.status === 2);
    const completedRidesCount = completedRides.length;
    const activeEscrowsCount = rides.filter(r => r.status === 0 || r.status === 1).length;
    const cancelledCount = rides.filter(r => r.status === 3).length;

    // Escrow Volumes
    const totalVolume = rides
      .filter(r => r.status !== 3) // Exclude cancelled refunds
      .reduce((sum, r) => sum + r.fare, 0);

    const activeVolume = rides
      .filter(r => r.status === 0 || r.status === 1)
      .reduce((sum, r) => sum + r.fare, 0);

    const completedVolume = completedRides.reduce((sum, r) => sum + r.fare, 0);

    // Reputation Ratings
    const ratedRides = completedRides.filter(r => r.rating > 0);
    const averageRating = ratedRides.length > 0
      ? (ratedRides.reduce((sum, r) => sum + r.rating, 0) / ratedRides.length)
      : 0;

    // Daily active wallets (unique addresses in rides)
    const uniqueWallets = new Set<string>();
    rides.forEach(r => {
      uniqueWallets.add(r.passenger);
      if (r.driver && r.driver !== r.passenger) {
        uniqueWallets.add(r.driver);
      }
    });

    res.json({
      metrics: {
        totalRides: totalRidesCount,
        completedRides: completedRidesCount,
        activeEscrows: activeEscrowsCount,
        cancelledRides: cancelledCount,
        escrowVolumeTotal: totalVolume,
        escrowVolumeActive: activeVolume,
        escrowVolumeSettled: completedVolume,
        averageRating: Number(averageRating.toFixed(2)),
        dailyActiveUsers: uniqueWallets.size,
        totalDrivers: drivers.length
      },
      walletActivity: Array.from(uniqueWallets)
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to compile analytics statistics" });
  }
});

// POST /api/verify-wallet - Verify wallet connection session (challenge response stub)
router.post("/verify-wallet", async (req: Request, res: Response) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    res.status(400).json({ error: "Missing walletAddress in request body" });
    return;
  }

  // Generate a mock JWT/session token or perform standard SDK verification check
  const sessionToken = `rmx_session_${Buffer.from(walletAddress + Date.now()).toString("base64")}`;
  
  res.json({
    success: true,
    walletAddress,
    token: sessionToken,
    expiresAt: Date.now() + 86400 * 1000 // 24 Hours
  });
});

// ----------------------------------------------------
// Sandbox Sync Endpoints (To sync Sandbox frontend state with backend)
// ----------------------------------------------------

// POST /api/sandbox/rides - Sync simulated sandbox rides
router.post("/sandbox/rides", async (req: Request, res: Response) => {
  const ride: IRide = req.body;
  if (!ride || typeof ride.rideId !== "number") {
    res.status(400).json({ error: "Invalid ride format" });
    return;
  }

  try {
    const saved = await Database.saveRide(ride);
    NotificationService.broadcast("sandbox_ride_synced", saved);
    res.status(201).json(saved);
  } catch (e) {
    res.status(500).json({ error: "Failed to sync sandbox ride" });
  }
});

// POST /api/sandbox/drivers - Sync simulated sandbox driver registrations
router.post("/sandbox/drivers", async (req: Request, res: Response) => {
  const driver: IDriver = req.body;
  if (!driver || !driver.wallet) {
    res.status(400).json({ error: "Invalid driver profile format" });
    return;
  }

  try {
    const saved = await Database.saveDriver(driver);
    NotificationService.broadcast("sandbox_driver_synced", saved);
    res.status(201).json(saved);
  } catch (e) {
    res.status(500).json({ error: "Failed to sync sandbox driver" });
  }
});

// POST /api/sandbox/drivers/verify - Verify driver in sandbox mode
router.post("/sandbox/drivers/verify", async (req: Request, res: Response) => {
  const { wallet } = req.body;
  if (!wallet) {
    res.status(400).json({ error: "Missing driver wallet address" });
    return;
  }

  try {
    const driver = await Database.getDriverByWallet(wallet);
    if (!driver) {
      res.status(404).json({ error: "Driver profile not found" });
      return;
    }

    driver.isVerified = true;
    const saved = await Database.saveDriver(driver);
    NotificationService.broadcast("sandbox_driver_verified", saved);
    res.json(saved);
  } catch (e) {
    res.status(500).json({ error: "Failed to verify sandbox driver" });
  }
});

// POST /api/feedback - Submit user feedback (Level 4 compliance)
router.post("/feedback", async (req: Request, res: Response) => {
  const { wallet, rating, comments } = req.body;
  if (!wallet || typeof rating !== "number" || !comments) {
    res.status(400).json({ error: "Missing required feedback fields" });
    return;
  }

  try {
    const feedback = {
      wallet,
      rating,
      comments,
      timestamp: Math.floor(Date.now() / 1000)
    };
    const saved = await Database.saveFeedback(feedback);
    NotificationService.broadcast("feedback_submitted", saved);
    res.status(201).json(saved);
  } catch (e) {
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// GET /api/feedback - Retrieve all feedbacks
router.get("/feedback", async (req: Request, res: Response) => {
  try {
    const feedbacks = await Database.getFeedback();
    res.json(feedbacks);
  } catch (e) {
    res.status(500).json({ error: "Failed to retrieve feedback list" });
  }
});

export default router;
