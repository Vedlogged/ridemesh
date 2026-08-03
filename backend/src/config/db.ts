import mongoose from "mongoose";
import { Database } from "../models/models";

export async function connectDB(): Promise<void> {
  const mongoURI = process.env.MONGODB_URI;

  if (mongoURI) {
    try {
      console.log("Attempting to connect to MongoDB...");
      await mongoose.connect(mongoURI);
      Database.setUseMongoDB(true);
      console.log("✓ MongoDB Connected Successfully!");
    } catch (error) {
      console.error("MongoDB Connection Failed, falling back to Local File DB:", error);
      Database.setUseMongoDB(false);
    }
  } else {
    console.log("No MONGODB_URI found in environment variables.");
    console.log("Using Local JSON File Database Fallback (zero-config sandbox mode).");
    Database.setUseMongoDB(false);
  }
}
