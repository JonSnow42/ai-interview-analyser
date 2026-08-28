import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_PATH = path.join(__dirname, '../.env');
dotenv.config({ path: ENV_PATH });

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// Check if API Key is configured and valid (not empty and not the placeholder)
export function isApiKeyConfigured() {
  return !!apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey.trim() !== '';
}

const genAI = isApiKeyConfigured() ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Call the Gemini model with a prompt and system instruction.
 */
export async function callGemini({ prompt, systemInstruction, jsonMode = false, jsonSchema = null }) {
  if (!genAI) {
    throw new Error('Gemini API client not initialized. Please set GEMINI_API_KEY in the backend/.env file.');
  }

  const modelOptions = { model: modelName };
  
  const generationConfig = {};
  if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
    if (jsonSchema) {
      generationConfig.responseSchema = jsonSchema;
    }
  }

  const model = genAI.getGenerativeModel(modelOptions);

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: systemInstruction,
      generationConfig: generationConfig
    });

    const response = result.response;
    const text = response.text();

    if (jsonMode) {
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse Gemini response as JSON. Raw text:', text);
        throw new Error('LLM did not return a valid JSON format: ' + e.message);
      }
    }

    return text;
  } catch (error) {
    console.error('Error during Gemini API call:', error);
    throw error;
  }
}
