import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Attachment from './models/Attachment.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const attachment = await Attachment.create({
      r2Key: 'test-key-' + Date.now(),
      userId: new mongoose.Types.ObjectId(),
      groupId: null,
      status: 'UPLOADING',
      size: 100
    });
    console.log("Success:", attachment._id);
  } catch (err) {
    console.error("Error name:", err.name);
    console.error("Error msg:", err.message);
  }
  process.exit();
}
run();
