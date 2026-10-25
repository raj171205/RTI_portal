import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Text ko 768-dimension vector array me convert karta hai
 * @param {string} text - Subject ya description
 * @returns {Promise<number[]>}
 */
export async function generateEmbedding(text) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    
    // Explicitly 768 dimensions request karein
    const result = await model.embedContent({
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    });

    return result.embedding.values;
  } catch (error) {
    console.error('Gemini Embedding Error:', error);
    throw error;
  }
}