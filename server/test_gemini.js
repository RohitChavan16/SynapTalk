import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-lite",
      systemInstruction: "You are Saras AI..."
    });
    
    const result = await model.generateContent("hello");
    console.log(result.response.text());
  } catch (e) {
    console.error("ERROR:");
    console.error(e);
  }
}
test();
