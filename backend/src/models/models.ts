import mongoose, { Schema, Document } from "mongoose";
import * as fs from "fs";
import * as path from "path";

// Define TypeScript Interfaces
export interface IRide {
  rideId: number;
  passenger: string;
  driver: string;
  fare: number;
  status: number; // 0 = Requested, 1 = Accepted, 2 = Completed, 3 = Cancelled
  rating: number; // 0 = Unrated, 1-5 = Rated
  timestamp: number;
  createdAt: Date;
}

export interface IDriver {
  wallet: string;
  name: string;
  vehicleNumber: string;
  vehicleType: string;
  licenseHash: string;
  isVerified: boolean;
  reputationScore: number; // average rating * 10
  totalRides: number;
  ratingSum: number;
  registrationDate: number;
}

export interface IFeedback {
  wallet: string;
  rating: number;
  comments: string;
  timestamp: number;
}

// ----------------------------------------------------
// MongoDB Mongoose Schemas (For Production Deployment)
// ----------------------------------------------------
const RideSchema: Schema = new Schema({
  rideId: { type: Number, required: true, unique: true },
  passenger: { type: String, required: true },
  driver: { type: String, required: true },
  fare: { type: Number, required: true },
  status: { type: Number, required: true, default: 0 },
  rating: { type: Number, required: true, default: 0 },
  timestamp: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const DriverSchema: Schema = new Schema({
  wallet: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  vehicleType: { type: String, required: true },
  licenseHash: { type: String, required: true },
  isVerified: { type: Boolean, required: true, default: false },
  reputationScore: { type: Number, required: true, default: 0 },
  totalRides: { type: Number, required: true, default: 0 },
  ratingSum: { type: Number, required: true, default: 0 },
  registrationDate: { type: Number, required: true }
});

const FeedbackSchema: Schema = new Schema({
  wallet: { type: String, required: true },
  rating: { type: Number, required: true },
  comments: { type: String, required: true },
  timestamp: { type: Number, required: true }
});

export const MongooseRide = mongoose.models.Ride || mongoose.model<IRide & Document>("Ride", RideSchema);
export const MongooseDriver = mongoose.models.Driver || mongoose.model<IDriver & Document>("Driver", DriverSchema);
export const MongooseFeedback = mongoose.models.Feedback || mongoose.model<IFeedback & Document>("Feedback", FeedbackSchema);

// ----------------------------------------------------
// Local JSON File Database Fallback (For Sandbox / Local Run)
// ----------------------------------------------------
const JSON_DB_DIR = path.join(__dirname, "../../data");
const RIDES_FILE = path.join(JSON_DB_DIR, "rides.json");
const DRIVERS_FILE = path.join(JSON_DB_DIR, "drivers.json");
const FEEDBACK_FILE = path.join(JSON_DB_DIR, "feedback.json");

// Ensure data folder exists
if (!fs.existsSync(JSON_DB_DIR)) {
  fs.mkdirSync(JSON_DB_DIR, { recursive: true });
}

function readJSON<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading database file ${filePath}:`, error);
  }
  return defaultVal;
}

function writeJSON<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error writing database file ${filePath}:`, error);
  }
}

// ----------------------------------------------------
// Unified Data Access API
// ----------------------------------------------------
export class Database {
  private static useMongoDB = false;

  public static setUseMongoDB(val: boolean) {
    this.useMongoDB = val;
  }

  // --- Rides Operations ---
  public static async getRides(): Promise<IRide[]> {
    if (this.useMongoDB) {
      return await MongooseRide.find().sort({ rideId: -1 });
    } else {
      const rides = readJSON<IRide[]>(RIDES_FILE, []);
      return rides.sort((a, b) => b.rideId - a.rideId);
    }
  }

  public static async saveRide(ride: IRide): Promise<IRide> {
    if (this.useMongoDB) {
      await MongooseRide.findOneAndUpdate(
        { rideId: ride.rideId },
        ride,
        { upsert: true, new: true }
      );
      return ride;
    } else {
      const rides = readJSON<IRide[]>(RIDES_FILE, []);
      const index = rides.findIndex(r => r.rideId === ride.rideId);
      if (index >= 0) {
        rides[index] = ride;
      } else {
        rides.push(ride);
      }
      writeJSON(RIDES_FILE, rides);
      return ride;
    }
  }

  public static async getRideById(rideId: number): Promise<IRide | null> {
    if (this.useMongoDB) {
      return await MongooseRide.findOne({ rideId });
    } else {
      const rides = readJSON<IRide[]>(RIDES_FILE, []);
      return rides.find(r => r.rideId === rideId) || null;
    }
  }

  // --- Drivers Operations ---
  public static async getDrivers(): Promise<IDriver[]> {
    if (this.useMongoDB) {
      return await MongooseDriver.find().sort({ reputationScore: -1 });
    } else {
      const drivers = readJSON<IDriver[]>(DRIVERS_FILE, []);
      return drivers.sort((a, b) => b.reputationScore - a.reputationScore);
    }
  }

  public static async saveDriver(driver: IDriver): Promise<IDriver> {
    if (this.useMongoDB) {
      await MongooseDriver.findOneAndUpdate(
        { wallet: driver.wallet },
        driver,
        { upsert: true, new: true }
      );
      return driver;
    } else {
      const drivers = readJSON<IDriver[]>(DRIVERS_FILE, []);
      const index = drivers.findIndex(d => d.wallet === driver.wallet);
      if (index >= 0) {
        drivers[index] = driver;
      } else {
        drivers.push(driver);
      }
      writeJSON(DRIVERS_FILE, drivers);
      return driver;
    }
  }

  public static async getDriverByWallet(wallet: string): Promise<IDriver | null> {
    if (this.useMongoDB) {
      return await MongooseDriver.findOne({ wallet });
    } else {
      const drivers = readJSON<IDriver[]>(DRIVERS_FILE, []);
      return drivers.find(d => d.wallet === wallet) || null;
    }
  }

  // --- Feedback Operations ---
  public static async getFeedback(): Promise<IFeedback[]> {
    if (this.useMongoDB) {
      return await MongooseFeedback.find().sort({ timestamp: -1 });
    } else {
      const feed = readJSON<IFeedback[]>(FEEDBACK_FILE, []);
      return feed.sort((a, b) => b.timestamp - a.timestamp);
    }
  }

  public static async saveFeedback(feedback: IFeedback): Promise<IFeedback> {
    if (this.useMongoDB) {
      const newFeed = new MongooseFeedback(feedback);
      await newFeed.save();
      return feedback;
    } else {
      const feeds = readJSON<IFeedback[]>(FEEDBACK_FILE, []);
      feeds.push(feedback);
      writeJSON(FEEDBACK_FILE, feeds);
      return feedback;
    }
  }
}
