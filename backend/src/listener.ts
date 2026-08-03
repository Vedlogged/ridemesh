import { rpc, Address, scValToNative } from "@stellar/stellar-sdk";
import { Database, IRide, IDriver } from "./models/models";
import { NotificationService } from "./services/notifications";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID;
const REPUTATION_CONTRACT_ID = process.env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID;
const DRIVER_IDENTITY_ID = process.env.NEXT_PUBLIC_DRIVER_IDENTITY_CONTRACT_ID;

const rpcServer = new rpc.Server(RPC_URL);
let isListening = false;
let lastProcessedLedger = 0;

export async function startEventListener(): Promise<void> {
  if (isListening) return;
  isListening = true;

  console.log("----------------------------------------------------------------");
  console.log(" Starting RideMesh Stellar Event Listener Daemon...");
  console.log(` - RPC Node: ${RPC_URL}`);
  console.log(` - Escrow Contract: ${CONTRACT_ID || "Not Configured"}`);
  console.log(` - Reputation Contract: ${REPUTATION_CONTRACT_ID || "Not Configured"}`);
  console.log(` - Identity Contract: ${DRIVER_IDENTITY_ID || "Not Configured"}`);
  console.log("----------------------------------------------------------------");

  try {
    const latestLedger = await rpcServer.getLatestLedger();
    lastProcessedLedger = latestLedger.sequence - 20; // Index starting 20 ledgers back to catch recent events
  } catch (err) {
    console.error("Listener failed to fetch latest ledger, starting from 0:", err);
  }

  // Poll every 6 seconds
  setInterval(async () => {
    try {
      await pollEvents();
    } catch (e) {
      console.error("Error during event polling loop:", e);
    }
  }, 6000);
}

async function pollEvents(): Promise<void> {
  if (!CONTRACT_ID && !REPUTATION_CONTRACT_ID && !DRIVER_IDENTITY_ID) {
    return; // Nothing to poll yet
  }

  const contractIds = [];
  if (CONTRACT_ID) contractIds.push(CONTRACT_ID);
  if (REPUTATION_CONTRACT_ID) contractIds.push(REPUTATION_CONTRACT_ID);
  if (DRIVER_IDENTITY_ID) contractIds.push(DRIVER_IDENTITY_ID);

  try {
    const latestResponse = await rpcServer.getLatestLedger();
    const currentLedger = latestResponse.sequence;

    if (currentLedger <= lastProcessedLedger) {
      return; // No new ledgers
    }

    const startLedger = lastProcessedLedger + 1;
    // Cap query to at most 100 ledgers at once to avoid RPC load limits
    const endLedger = Math.min(currentLedger, startLedger + 100);

    const eventResponse = await rpcServer.getEvents({
      startLedger: startLedger,
      filters: [
        {
          type: "contract",
          contractIds: contractIds
        }
      ],
      limit: 50
    });

    if (eventResponse.events && eventResponse.events.length > 0) {
      console.log(`Indexed ${eventResponse.events.length} new Soroban ledger events.`);
      for (const event of eventResponse.events) {
        await handleEvent(event);
      }
    }

    lastProcessedLedger = endLedger;
  } catch (error) {
    console.error("Error polling Stellar events:", error);
  }
}

async function handleEvent(event: any): Promise<void> {
  try {
    const topics = event.topic;
    if (!topics || topics.length === 0) return;

    const eventName = scValToNative(topics[0]) as string;
    const actorAddress = scValToNative(topics[1]) as string;
    const identifier = topics[2] ? scValToNative(topics[2]) : null;
    const rawVal = scValToNative(event.value);

    console.log(`Event detected: [${eventName}] by ${actorAddress} ID: ${identifier}`);

    if (eventName === "ride_req" && typeof identifier === "number") {
      // Passenger requested ride
      const rideId = identifier;
      const fare = Number(rawVal) / 10_000_000; // Stroops scale conversion

      const newRide: IRide = {
        rideId,
        passenger: actorAddress,
        driver: actorAddress, // Placeholder
        fare,
        status: 0, // Requested
        rating: 0,
        timestamp: Math.floor(Date.now() / 1000),
        createdAt: new Date()
      };

      await Database.saveRide(newRide);
      NotificationService.broadcast("ride_requested", newRide);
    } 
    else if (eventName === "ride_acc" && typeof identifier === "number") {
      // Driver accepted ride
      const rideId = identifier;
      const driverAddress = actorAddress;

      const ride = await Database.getRideById(rideId);
      if (ride) {
        ride.driver = driverAddress;
        ride.status = 1; // Accepted / In Progress
        await Database.saveRide(ride);
        NotificationService.broadcast("ride_accepted", ride);
      }
    } 
    else if (eventName === "ride_comp" && typeof identifier === "number") {
      // Passenger confirms completed ride
      const rideId = identifier;

      const ride = await Database.getRideById(rideId);
      if (ride) {
        ride.status = 2; // Completed
        await Database.saveRide(ride);
        NotificationService.broadcast("ride_completed", ride);
      }
    } 
    else if (eventName === "ride_canc" && typeof identifier === "number") {
      // Ride cancelled
      const rideId = identifier;

      const ride = await Database.getRideById(rideId);
      if (ride) {
        ride.status = 3; // Cancelled
        await Database.saveRide(ride);
        NotificationService.broadcast("ride_cancelled", ride);
      }
    } 
    else if (eventName === "driver_rt" && typeof identifier === "number") {
      // Driver rated
      const rideId = identifier;
      const rating = Number(rawVal);

      const ride = await Database.getRideById(rideId);
      if (ride) {
        ride.rating = rating;
        await Database.saveRide(ride);

        // Fetch and sync updated driver profile metrics
        const driverWallet = ride.driver;
        const driver = await Database.getDriverByWallet(driverWallet);
        if (driver) {
          driver.totalRides += 1;
          driver.ratingSum += rating;
          driver.reputationScore = Math.round((driver.ratingSum * 10) / driver.totalRides);
          await Database.saveDriver(driver);
          NotificationService.broadcast("driver_reputation_updated", driver);
        }

        NotificationService.broadcast("ride_rated", { rideId, rating, driver: driverWallet });
      }
    }
  } catch (error) {
    console.error("Failed to parse and handle event:", error);
  }
}
