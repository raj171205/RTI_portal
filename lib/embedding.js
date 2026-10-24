import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});


export async function generateEmbedding(text) {
  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });

    return response.embedding.values;
  } catch (error) {
    console.error('Gemini Embedding Error:', error);
    throw error;
  }
}