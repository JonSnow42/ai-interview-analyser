import { getPDFText } from './pdfParser.js';
import { callGemini } from './llmClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../cache');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

const PROFILE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'The full name of the candidate.' },
    years_of_experience: { type: 'NUMBER', description: 'The candidate\'s total years of professional experience as stated or deduced.' },
    transcript_provided: { type: 'BOOLEAN', description: 'Whether an interview transcript was provided and parsed for this candidate. Must match the value passed in prompt.' },
    skills_claimed: {
      type: 'ARRAY',
      description: 'Skills mentioned in the resume or transcript.',
      items: {
        type: 'OBJECT',
        properties: {
          skill: { type: 'STRING', description: 'Name of the skill or technology.' },
          years_of_experience: { type: 'NUMBER', description: 'Years of experience with this skill. Put 0 if not explicitly clear.' },
          context: { type: 'STRING', description: 'Brief context of how/where they used it (e.g. "Used at Company X for building Y").' }
        },
        required: ['skill', 'years_of_experience', 'context']
      }
    },
    specific_claims: {
      type: 'ARRAY',
      description: 'Specific assertions made by the candidate about their achievements or responsibilities.',
      items: {
        type: 'OBJECT',
        properties: {
          claim: { type: 'STRING', description: 'The specific accomplishment, responsibility, or project claimed.' },
          evidence: { type: 'STRING', description: 'Exact quote or description of evidence from the resume or transcript supporting this claim.' }
        },
        required: ['claim', 'evidence']
      }
    },
    notable_quotes: {
      type: 'ARRAY',
      description: 'Notable quotes from the transcript representing their attitude, experience, or technical views. MUST be empty if transcript_provided is false.',
      items: {
        type: 'OBJECT',
        properties: {
          quote: { type: 'STRING', description: 'The exact quote from the interview transcript.' },
          context: { type: 'STRING', description: 'The context of why this quote is significant or what question it was answering.' }
        },
        required: ['quote', 'context']
      }
    }
  },
  required: ['name', 'years_of_experience', 'skills_claimed', 'specific_claims', 'notable_quotes', 'transcript_provided']
};

/**
 * Builds a structured candidate profile from their resume and transcript text.
 * @param {string} candidateId - 'A' or 'B'
 * @returns {Promise<object>} The candidate profile JSON object
 */
export async function buildCandidateProfile(candidateId) {
  const profileCacheFile = path.join(CACHE_DIR, `candidate_${candidateId.toLowerCase()}_profile.json`);

  // Check cache first
  if (fs.existsSync(profileCacheFile)) {
    console.log(`[Cache Hit] Reading cached candidate profile for Candidate ${candidateId}`);
    return JSON.parse(fs.readFileSync(profileCacheFile, 'utf-8'));
  }

  console.log(`[Cache Miss] Generating candidate profile for Candidate ${candidateId}`);

  // Determine file paths
  const resumeFile = candidateId.toUpperCase() === 'A' ? 'resume_a.pdf' : 'resume_b.pdf';
  const transcriptFile = candidateId.toUpperCase() === 'A' ? 'transcript_a.pdf' : 'transcript_b.pdf';
  const jdFile = 'job_description.pdf';

  // Extract text
  const resumeText = await getPDFText(resumeFile);
  const jdText = await getPDFText(jdFile);

  // Check if transcript file was uploaded/exists
  const transcriptPath = path.join(UPLOADS_DIR, transcriptFile);
  let transcriptText = "";
  let transcriptProvided = false;
  if (fs.existsSync(transcriptPath)) {
    try {
      transcriptText = await getPDFText(transcriptFile);
      transcriptProvided = true;
      console.log(`[Profile Builder] Transcript found for Candidate ${candidateId}`);
    } catch (e) {
      console.log(`[Profile Builder] Could not parse transcript for Candidate ${candidateId}: ${e.message}`);
    }
  } else {
    console.log(`[Profile Builder] No transcript file found for Candidate ${candidateId}`);
  }

  const systemInstruction = `You are an expert HR Data Scientist and Recruiting Coordinator. Your job is to parse a candidate's resume and (if provided) interview transcript to build a highly structured, accurate, and completely factual Candidate Profile. 
Do not hallucinate, exaggerate, or invent any claims. If the years of experience for a skill are not specified, set it to 0. Every quote in 'notable_quotes' or 'specific_claims' must be an EXACT, literal quote from the provided resume or transcript text.
CRITICAL: If the transcript is not provided (transcript_provided is false), the 'notable_quotes' array MUST be empty, and all claims/evidence in 'specific_claims' must come strictly from the resume.`;

  const transcriptSection = transcriptProvided
    ? `Candidate Interview Transcript:\n${transcriptText}`
    : `Candidate Interview Transcript:\n[NOT PROVIDED - NO INTERVIEW CONDUCTED YET]`;

  const prompt = `Please build a structured profile for Candidate ${candidateId.toUpperCase()} based on their resume and interview transcript. Here is the job description for context:
---
JOB DESCRIPTION:
${jdText}
---

Candidate Resume:
${resumeText}

${transcriptSection}

Extract and structure all details into the specified JSON format. Ensure all quotes are verbatim from the texts. 
Set transcript_provided to ${transcriptProvided}. Since transcript_provided is ${transcriptProvided}, adjust the outputs accordingly (if false, notable_quotes must be empty, and all evidence must come from the resume).`;

  try {
    const profile = await callGemini({
      prompt,
      systemInstruction,
      jsonMode: true,
      jsonSchema: PROFILE_SCHEMA
    });

    // Write to cache
    fs.writeFileSync(profileCacheFile, JSON.stringify(profile, null, 2), 'utf-8');
    console.log(`[Cache Write] Saved candidate profile for Candidate ${candidateId}`);
    return profile;
  } catch (error) {
    console.error(`Error building profile for Candidate ${candidateId}:`, error);
    throw error;
  }
}
