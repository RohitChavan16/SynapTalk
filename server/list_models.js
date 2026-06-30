import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import axios from 'axios';
dotenv.config();

async function listModels() {
  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const models = res.data.models;
    for (const m of models) {
      if (m.name.includes("gemini")) {
        console.log(m.name, m.supportedGenerationMethods);
      }
    }
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
listModels();
