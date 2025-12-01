import mongoose from "mongoose";
import { DatabaseName } from "./config";

let isConnected = false;

export async function connectDb() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI!;

  await mongoose.connect(uri, {
    dbName: DatabaseName,
    minPoolSize: 1,
    maxPoolSize: 5,
  });

  isConnected = true;
}

// Re-export models for convenience
export { Post, Like, User } from "../models";
