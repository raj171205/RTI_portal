import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function draftRTIWithAI(roughPrompt) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `
You are an expert Indian Right to Information (RTI Act, 2005) legal assistant.
Convert the citizen's rough query into a clear, formal, point-by-point RTI application.

Citizen Query: "${roughPrompt}"

Return ONLY a valid JSON object with these exact keys:
{
  "subject": "Concise formal subject line (between 15 and 95 characters)",
  "category": "Must be strictly one of: Public Works Department | Municipal Corporation | Education Department | Health & Sanitation | Electricity & Water Supply",
  "description": "Formal RTI Act 2005 request starting with 'Under Section 6(1) of the Right to Information Act, 2005, please provide the following information:' followed by 3-5 numbered, specific, factual questions (between 100 and 1500 characters)."
}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text);
}