import { callGemini } from './llmClient.js';
import { getPDFText } from './pdfParser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../cache');

const AGENT_OUTPUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    score: { 
      type: 'NUMBER', 
      description: 'An evaluation score from 1 to 10. If evidence is insufficient to make a judgment, set to 0 (representing insufficient evidence).' 
    },
    confidence: { 
      type: 'NUMBER', 
      description: 'Confidence in the evaluation score from 1 (very low) to 5 (very high).' 
    },
    opinion: { 
      type: 'STRING', 
      description: 'Detailed analysis, evaluation, and explanation of the decision.' 
    },
    evidence: {
      type: 'ARRAY',
      description: 'List of exact quotes and facts supporting this opinion.',
      items: {
        type: 'OBJECT',
        properties: {
          quote: { type: 'STRING', description: 'The exact quote from the candidate profile.' },
          source: { type: 'STRING', description: 'The source of this quote (e.g. Resume, Transcript, etc.).' }
        },
        required: ['quote', 'source']
      }
    },
    gaps: { 
      type: 'STRING', 
      description: 'Aspects of the candidate\'s profile/experience that could not be assessed and why.' 
    }
  },
  required: ['score', 'confidence', 'opinion', 'evidence', 'gaps']
};

const AGENT_DEFINITIONS = {
  technical: {
    name: 'Technical Agent',
    systemInstruction: `You are the Technical Agent of the hiring panel. Your sole focus is to evaluate the candidate's technical depth, system design knowledge, coding proficiency, and architectural experience against the job description. Do not evaluate culture fit or overall project management. Ground your score and analysis purely on the technical skills, concrete claims, and interview transcripts. If there is insufficient evidence to assess technical capability in the profile, set the score to 0 and explain the gap.`
  },
  hr_culture: {
    name: 'HR/Culture Agent',
    systemInstruction: `You are the HR/Culture Agent of the hiring panel. Your sole focus is to evaluate the candidate's communication style, teamwork capability, honesty/consistency (whether claims align across resume and transcript), conflict resolution, and behavioral indicators. Focus on how they talk about colleagues, how they explain setbacks, and whether they contradict themselves. Do not evaluate technical skill. Ground your opinion purely on quotes from the transcript and facts in the profile. If there is insufficient evidence, set the score to 0 and explain.`
  },
  hiring_manager: {
    name: 'Hiring Manager Agent',
    systemInstruction: `You are the Hiring Manager Agent. Your focus is the high-level business and role fit. Evaluate whether the candidate has the right level of experience, seniority, adaptability, and leadership qualities for the role. Analyze if their previous experience translates directly to the needs of the team. Weigh their overall trajectory. If there is insufficient evidence, set the score to 0 and explain.`
  },
  skeptic: {
    name: 'Skeptic Agent',
    systemInstruction: `You are the Skeptic Agent. Your job is to be the critical auditor of this candidate. Actively search for contradictions, exaggerations, vague answers, buzzword-dropping without substance, gaps in employment, red flags, or potential inconsistencies between what is claimed on the resume and what is actually described in the interview. Do not take claims at face value. Highlight what they avoided answering or answered evasively. If there is insufficient evidence or no red flags are found, explain clearly and score accordingly.`
  }
};

/**
 * Runs the 4 independent agent evaluations in parallel.
 * @param {string} candidateId - 'A' or 'B'
 * @param {object} profile - The candidate profile JSON object
 * @returns {Promise<object>} Map of agent keys to their evaluation JSON objects
 */
export async function evaluateCandidateAgents(candidateId, profile) {
  const cacheFile = path.join(CACHE_DIR, `candidate_${candidateId.toLowerCase()}_opinions.json`);

  // Check cache first
  if (fs.existsSync(cacheFile)) {
    console.log(`[Cache Hit] Reading cached agent opinions for Candidate ${candidateId}`);
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  }

  console.log(`[Cache Miss] Generating agent opinions for Candidate ${candidateId}`);

  // Fetch JD text
  const jdText = await getPDFText('job_description.pdf');

  // Prompt template for agents
  const getPrompt = (agentName) => {
    let transcriptMessage = "";
    if (profile.transcript_provided === false) {
      transcriptMessage = `\nCRITICAL WARNING: No interview transcript was provided for this candidate (profile.transcript_provided is false). You only have their resume text. As the ${agentName}, you MUST explicitly state in the 'opinion' and 'gaps' fields which aspects of the candidate's performance or behavioral qualities you cannot assess from a resume alone (e.g., HR/Culture cannot judge communication or teamwork, Technical Agent cannot verify real-time problem solving or architecture depth without transcript details). Do not guess or extrapolate. Set the 'score' to 0 for areas that are completely missing due to no transcript, or lower your score/confidence with an explicit explanation. Do not assume high scores without evidence.`;
    }

    return `You are evaluating Candidate: ${profile.name}.
Here is the Job Description for the role:
---
JOB DESCRIPTION:
${jdText}
---

Here is the Candidate Profile (which is the ONLY context you receive about the candidate):
---
CANDIDATE PROFILE:
${JSON.stringify(profile, null, 2)}
---
${transcriptMessage}

Evaluate the candidate from the perspective of the ${agentName}.
Every claim in your evaluation MUST be backed by a quote from the candidate profile in the 'evidence' field.
If there is insufficient evidence in the profile for you to evaluate a specific dimension, set the 'score' to 0 and explain this clearly in the 'gaps' and 'opinion' fields. Do not make up a score.`;
  };

  // Run calls in parallel
  const agentKeys = Object.keys(AGENT_DEFINITIONS);
  const evaluationPromises = agentKeys.map(async (key) => {
    const agent = AGENT_DEFINITIONS[key];
    console.log(`Starting independent evaluation for: ${agent.name}`);
    
    try {
      const result = await callGemini({
        prompt: getPrompt(agent.name),
        systemInstruction: agent.systemInstruction,
        jsonMode: true,
        jsonSchema: AGENT_OUTPUT_SCHEMA
      });
      console.log(`Completed evaluation for: ${agent.name}`);
      return { key, data: result };
    } catch (error) {
      console.error(`Error in evaluation for ${agent.name}:`, error);
      throw error;
    }
  });

  const results = await Promise.all(evaluationPromises);

  // Convert array of results to object map
  const opinions = {};
  results.forEach(({ key, data }) => {
    opinions[key] = {
      agentName: AGENT_DEFINITIONS[key].name,
      ...data
    };
  });

  // Write to cache
  fs.writeFileSync(cacheFile, JSON.stringify(opinions, null, 2), 'utf-8');
  console.log(`[Cache Write] Saved agent opinions for Candidate ${candidateId}`);
  
  return opinions;
}
