const router = require('express').Router();
const upload = require('../../middlewares/fileUpload')
const {PrismaClient} = require('../../generate/prisma')
const prisma = new PrismaClient()
const folders = ["aadhaar", "pan", "photo", "address", "signature"];
const {v4 : uuid} = require('uuid')
const fs = require('fs')
folders.forEach(folder => {
  const dir = `./uploads/${folder}`;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Upload Route
router.post(
  "/",
  upload.fields([
    { name: "aadhaar", maxCount: 2 },
    { name: "pan", maxCount: 1 },
    { name: "photo", maxCount: 1 },
    { name: "address", maxCount: 1 },
    { name: "signature", maxCount: 1 },
  ]),
  async (req, res) => {
    const {
      aadhaar_number,
      pan_number,
      has_address_proof,
      address,
      data_of_birth,
      customer_ID
    } = req.body;

    const files = req.files;

    // Validations
    if (!pan_number || pan_number.trim() === "") {
      return res.status(400).json({ error: "PAN Card number is required." });
    }
    if(has_address_proof ==="yes" && !address){
      return res.status(400).json({ error: "address is required." });
    }
    if (has_address_proof === "yes" && !files.address) {
      return res.status(400).json({ error: "Address proof must be uploaded." });
    }

    // Optional Aadhaar number but should be masked
    if (aadhaar_number && !/^\d{12}$/.test(aadhaar_number)) {
      return res.status(400).json({ error: "Invalid Aadhaar number." });
    }
    const kyc_ID = uuid()
    await prisma.kYC.create({
      data: {
        kycId: kyc_ID,
        dateOfBirth: data_of_birth,
        aadhaarNumber: aadhaar_number,
        panNumber: pan_number,
        address: has_address_proof === "yes" ?address:'',
      }
    })
    await prisma.user.update({
      where: {
        customerId: customer_ID
      },
      data:{
        kycId: kyc_ID
      }
    })
    // Store file info and fields (in DB or temp for now)
    const response = {
      aadhaarNumber: aadhaar_number ? "XXXX-XXXX-" + aadhaar_number.slice(-4) : null,
      pan_number,
      has_address_proof,
      filesUploaded: Object.keys(files)
    };

    return res.status(200).json({ message: "KYC submitted successfully", data: response });
  }
);

module.exports = router