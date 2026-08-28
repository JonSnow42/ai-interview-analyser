import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../cache');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Ensure cache and upload directories exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Extracts text from a PDF file in the uploads directory and caches the result.
 * @param {string} pdfFilename - Name of the PDF file (e.g. 'resume_a.pdf')
 * @returns {Promise<string>} Extracted text content
 */
export async function getPDFText(pdfFilename) {
  const cacheFile = path.join(CACHE_DIR, `${pdfFilename}.txt`);
  
  // Check if cache exists
  if (fs.existsSync(cacheFile)) {
    console.log(`[Cache Hit] Reading cached text for ${pdfFilename}`);
    return fs.readFileSync(cacheFile, 'utf-8');
  }

  // Parse PDF
  const pdfPath = path.join(UPLOADS_DIR, pdfFilename);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found at path: ${pdfPath}`);
  }

  console.log(`[Cache Miss] Parsing PDF file: ${pdfFilename}`);
  const dataBuffer = fs.readFileSync(pdfPath);
  
  try {
    const data = await pdf(dataBuffer);
    const text = data.text;
    
    // Save to cache
    fs.writeFileSync(cacheFile, text, 'utf-8');
    console.log(`[Cache Write] Saved parsed text for ${pdfFilename}`);
    return text;
  } catch (error) {
    console.error(`Error parsing PDF ${pdfFilename}:`, error);
    throw error;
  }
}
