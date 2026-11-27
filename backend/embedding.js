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

function buildFallbackRTIDraft(rawQuery) {
  const q = rawQuery.toLowerCase();
  let category = "General Administration";
  if (q.includes("sadak") || q.includes("road") || q.includes("pwd") || q.includes("pul") || q.includes("bridge")) {
    category = "Public Works Department (PWD)";
  } else if (q.includes("school") || q.includes("college") || q.includes("scholarship") || q.includes("exam")) {
    category = "Education Department";
  } else if (q.includes("hospital") || q.includes("dawai") || q.includes("medicine") || q.includes("health")) {
    category = "Health Department";
  } else if (q.includes("bijli") || q.includes("electricity") || q.includes("meter") || q.includes("power")) {
    category = "Electricity Board";
  } else if (q.includes("police") || q.includes("fir") || q.includes("thana")) {
    category = "Police Department";
  } else if (q.includes("nagar") || q.includes("municipal") || q.includes("kachra") || q.includes("water") || q.includes("pani")) {
    category = "Municipal Corporation";
  } else if (q.includes("zameen") || q.includes("land") || q.includes("revenue") || q.includes("ration")) {
    category = "Revenue Department";
  }

  const cleanTopic = rawQuery.trim().replace(/[?.!]+$/, "");
  const subject = `Request for Official Information regarding ${cleanTopic}`.slice(0, 95);

  const description = `Under Section 6(1) of the Right to Information Act, 2005, please provide certified copies and point-wise official records regarding "${cleanTopic}":
1. Complete details of the total sanctioned budget, expenditure incurred, and copy of approved work orders/sanction letters.
2. Name and designation of the officer(s) and contractor/agency responsible for execution and quality inspection.
3. Current official status, action taken report (ATR), and timeline for completion or resolution.
4. Copies of all inspection reports, measurement books (MB), and public grievance records on file.`;

  return { subject, category, description };
}

export async function draftRTIWithAI(rawQuery) {
  const prompt = `You are an expert Indian legal assistant specializing in the Right to Information (RTI) Act, 2005.
Convert the following citizen query into a formal, clear, and legally valid Indian RTI application.
Return a JSON object with exactly three keys:
- "subject": concise subject line (15-90 characters)
- "category": one of "Public Works Department (PWD)", "Municipal Corporation", "Education Department", "Police Department", "Electricity Board", "Health Department", "Revenue Department", or "General Administration"
- "description": numbered list of specific, objective questions seeking official records under Section 6(1) of the RTI Act, 2005 (200-1200 characters). Do NOT include personal salutations or signatures.

Citizen Query: "${rawQuery}"`;

  const model = genAI.getGenerativeModel({
    model: "gemini-3.8-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (err) {
      console.error(`gemini-3.8-flash attempt ${attempt} failed:`, err.status || err.message);
      if ((err.status === 503 || err.status === 429) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      if (err.status === 503 || err.status === 429) {
        console.warn("Gemini temporarily overloaded (503). Serving smart legal RTI fallback template.");
        return buildFallbackRTIDraft(rawQuery);
      }
      throw err;
    }
  }
}