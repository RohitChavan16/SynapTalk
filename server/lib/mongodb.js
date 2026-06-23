import mongoose from "mongoose";
import logger from './logger.js';

export const connectDB = async () => {
    try{
        mongoose.connection.on("connected", ()=> logger.info("Database Connected"));
        await mongoose.connect(`${process.env.MONGODB_URI}/synap-talk`);
    } catch (error) {
       logger.error("MongoDB Connection Error:", error);
    }
}