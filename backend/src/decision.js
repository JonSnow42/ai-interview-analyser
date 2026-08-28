import { callGemini } from './llmClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../cache');

const DECISION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    recommendation: { 
      type: 'STRING', 
      description: 'The final recommendation. Must be one of: "Hire", "No Hire", "Borderline".' 
    },
    confidence: { 
      type: 'NUMBER', 
      description: 'The confidence level in the decision, from 1 (very low) to 5 (very high).' 
    },
    rationale: { 
      type: 'STRING', 
      description: 'Detailed explanation of how the decision was reached, weighing agent opinions and explaining why simple score averaging was not used.' 
    },
    decisive_evidence: {
      type: 'ARRAY',
      description: 'A list of key quotes and facts from the profile that were decisive in the final recommendation.',
      items: {
        type: 'OBJECT',
        properties: {
          quote: { type: 'STRING', description: 'The exact quote or fact.' },
          source: { type: 'STRING', description: 'The source document/section.' },
          agent_origin: { type: 'STRING', description: 'The agent that originally presented or emphasized this evidence.' }
        },
        required: ['quote', 'source', 'agent_origin']
      }
    },
    agent_weights: {
      type: 'ARRAY',
      description: 'How much weight was given to each agent and why.',
      items: {
        type: 'OBJECT',
        properties: {
          agent: { type: 'STRING', description: 'Agent name.' },
          weight: { type: 'STRING', description: 'Weight assigned (e.g. High, Medium, Low).' },
          reason: { type: 'STRING', description: 'Explanation of why this weight was assigned based on their confidence and debate contributions.' }
        },
        required: ['agent', 'weight', 'reason']
      }
    }
  },
  required: ['recommendation', 'confidence', 'rationale', 'decisive_evidence', 'agent_weights']
};

/**
 * Runs the final judge decision step.
 * @param {string} candidateId - 'A' or 'B'
 * @param {object} profile - Candidate Profile JSON object
 * @param {object} opinions - Map of independent agent opinions
 * @param {object} debate - Debate interactions log
 * @returns {Promise<object>} The final decision JSON object
 */
export async function runFinalDecision(candidateId, profile, opinions, debate) {
  const cacheFile = path.join(CACHE_DIR, `candidate_${candidateId.toLowerCase()}_decision.json`);

  // Check cache first
  if (fs.existsSync(cacheFile)) {
    console.log(`[Cache Hit] Reading cached final decision for Candidate ${candidateId}`);
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  }

  console.log(`[Cache Miss] Generating final decision for Candidate ${candidateId}`);

  let decisionInstruction = "";
  if (profile.transcript_provided === false) {
    decisionInstruction = `\n7. CRITICAL JUDGE RULE (Resume-Only Mode): The candidate's interview transcript was not provided (transcript_provided is false). Your final recommendation is based entirely on a resume-only evaluation. Your rationale must explicitly note that this is a resume-only evaluation, and that the panel's confidence is inherently lower (typically 1 or 2 out of 5) because verbal ability, communication, integrity, and direct verification of resume achievements remain unassessed. You MUST explicitly recommend that a formal interview be conducted before making a final hire/no-hire decision.`;
  }

  const systemInstruction = `You are the Hiring Panel Judge / Lead Architect. Your role is to analyze the entire evaluation lifecycle of a candidate (independent agent assessments + debate outcomes) and render a final hiring decision.
You must NOT simply average the scores. Instead:
1. Review the initial independent scores, confidence levels, and GAPs of all 4 agents.
2. Review how they debated, and whether any agent revised their position (e.g., lowering or raising their score based on arguments/evidence presented by others).
3. Evaluate which evidence is most credible, rigorous, and relevant to the Job Description.
4. Assign qualitative weights (High/Medium/Low) to each agent's opinion based on their confidence, focus area, and debate performance, providing explicit reasons.
5. Render a final decision: "Hire", "No Hire", or "Borderline", along with a confidence level (1-5) and a written rationale citing the decisive evidence.
6. Ensure all decisive evidence is grounded in real, verbatim quotes with their source and agent origin.${decisionInstruction}`;

  const prompt = `Please review the full hiring process for Candidate: ${profile.name}.
Candidate Profile:
---
${JSON.stringify(profile, null, 2)}
---

Independent Agent Opinions:
---
${JSON.stringify(opinions, null, 2)}
---

Debate Interactions:
---
${JSON.stringify(debate, null, 2)}
---

Provide your final decision, confidence score, rationale, decisive evidence, and agent weights in the required JSON format.`;

  try {
    const decision = await callGemini({
      prompt,
      systemInstruction,
      jsonMode: true,
      jsonSchema: DECISION_SCHEMA
    });

    // Write to cache
    fs.writeFileSync(cacheFile, JSON.stringify(decision, null, 2), 'utf-8');
    console.log(`[Cache Write] Saved final decision for Candidate ${candidateId}`);
    return decision;
  } catch (error) {
    console.error(`Error running final decision for Candidate ${candidateId}:`, error);
    throw error;
  }
}
