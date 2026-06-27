import express from "express";
import { getUploadSignature, markUploadComplete } from "../controllers/uploadController.js";
import { protectRoute } from "../middleware/auth.js";

const router = express.Router();

// Require authentication for all upload routes
router.use(protectRoute);

router.post("/signature", getUploadSignature);
router.post("/complete", markUploadComplete);

export default router;
