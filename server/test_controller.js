import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./lib/mongodb.js";
import { handleAIMessage } from "./controllers/aiController.js";
import User from "./models/User.js";
import { redisClient } from './lib/redis.js';

async function runTest() {
  await connectDB();
  const user = await User.findOne();
  if (!user) {
    console.log("No user found");
    return;
  }
  
  const req = {
    body: {
      text: "@saras hello",
      receiverId: user._id.toString()
    },
    user: user
  };
  
  const res = {
    status: function(code) {
      console.log("Status:", code);
      return this;
    },
    json: function(data) {
      console.log("JSON Response:", data);
    }
  };
  
  // mock redis to prevent crash
  redisClient.xadd = async () => {};
  
  try {
    await handleAIMessage(req, res);
  } catch (e) {
    console.error("Caught error:", e);
  }
  
  process.exit(0);
}

runTest();
