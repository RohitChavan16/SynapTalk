import axios from "axios";
import fs from "fs";

async function testDownload() {
  const url = "http://localhost:9002/synaptalk-media/7aa2ad59-8c58-4f61-9e46-780f0adcc778";
  try {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    console.log("Status:", res.status);
    console.log("Length:", res.data.length);
    console.log("Content:", res.data.toString().substring(0, 50));
  } catch (err) {
    console.error("Error downloading:", err.message);
  }
}

testDownload();
