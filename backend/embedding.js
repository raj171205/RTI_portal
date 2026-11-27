import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: 768,
  });
  return result.embedding.values;
}

export async function draftRTIWithAI(rawQuery) {
  const prompt = `You are an expert Indian legal assistant specializing in the Right to Information (RTI) Act, 2005.
Convert the following citizen query into a formal, clear, and legally valid Indian RTI application.
Return ONLY a valid JSON object with three keys:
- "subject": concise subject line (15-90 characters)
- "category": most relevant Indian government department (e.g., Public Works Department (PWD), Municipal Corporation, Education Department, Police Department, Electricity Board, Health Department, Revenue Department, or General Administration)
- "description": numbered list of specific, objective questions seeking official records/information under Section 6(1) of the RTI Act, 2005 (200-1200 characters). Do NOT include personal salutations or signatures.

Citizen Query: "${rawQuery}"`;

  const tryGenerate = async (modelName) => {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    return result.response.text();
  };

  let rawText;
  try {
    rawText = await tryGenerate("gemini-3.8-flash");
  } catch (err) {
    if (err.status === 503 || err.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      rawText = await tryGenerate("gemini-3.8-flash");
    } else {
      throw err;
    }
  }

  const cleaned = rawText.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}
