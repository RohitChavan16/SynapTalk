import express from "express";
import { getUploadSignature, markUploadComplete } from "../controllers/uploadController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Require authentication for all upload routes
router.use(protect);

router.post("/signature", getUploadSignature);
router.post("/complete", markUploadComplete);

export default router;
