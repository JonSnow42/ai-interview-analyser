import { callGemini } from './llmClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../cache');

const DEBATE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    debate_interactions: {
      type: 'ARRAY',
      description: 'A chronological list of turns in the debate.',
      items: {
        type: 'OBJECT',
        properties: {
          agent: { type: 'STRING', description: 'The agent speaking. Must be one of: "Technical Agent", "HR/Culture Agent", "Hiring Manager Agent", "Skeptic Agent".' },
          reacting_to: { type: 'STRING', description: 'The agent this speaker is responding to.' },
          original_position: {
            type: 'OBJECT',
            properties: {
              score: { type: 'NUMBER', description: 'The agent\'s score before this turn (1-10).' },
              opinion: { type: 'STRING', description: 'The agent\'s core position or stance before this turn.' }
            },
            required: ['score', 'opinion']
          },
          new_position: {
            type: 'OBJECT',
            properties: {
              score: { type: 'NUMBER', description: 'The agent\'s score after this turn (1-10). If they did not change their score, it should be the same as original_position.score.' },
              opinion: { type: 'STRING', description: 'The agent\'s opinion/commentary during and after this turn.' }
            },
            required: ['score', 'opinion']
          },
          reason_for_change_or_holding: { 
            type: 'STRING', 
            description: 'Why the agent decided to change their score or maintain their current position. Must reference the specific evidence/point raised by the other agent.' 
          }
        },
        required: ['agent', 'reacting_to', 'original_position', 'new_position', 'reason_for_change_or_holding']
      }
    }
  },
  required: ['debate_interactions']
};

/**
 * Runs the debate step among the four agents.
 * @param {string} candidateId - 'A' or 'B'
 * @param {object} profile - Candidate Profile JSON object
 * @param {object} opinions - Map of independent agent opinions
 * @returns {Promise<object>} The debate interactions log
 */
export async function runCandidateDebate(candidateId, profile, opinions) {
  const cacheFile = path.join(CACHE_DIR, `candidate_${candidateId.toLowerCase()}_debate.json`);

  // Check cache first
  if (fs.existsSync(cacheFile)) {
    console.log(`[Cache Hit] Reading cached debate log for Candidate ${candidateId}`);
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  }

  console.log(`[Cache Miss] Generating debate log for Candidate ${candidateId}`);

  let transcriptDebateRule = "";
  if (profile.transcript_provided === false) {
    transcriptDebateRule = `\n6. CRITICAL DEBATE RULE (Resume-Only Mode): The candidate's interview transcript was not provided (transcript_provided is false). During this debate, the agents MUST actively raise the lack of transcript evidence as a key debate point. The agents should critique each other's scores by emphasizing that core behavioral qualities, teamwork capabilities, live technical reasoning, and veracity of claims remain completely unverified. They should debate the risk of recommending a hire based purely on resume claims without any live interview data.`;
  }

  const systemInstruction = `You are a Hiring Panel Moderator. You are moderating a structured debate among four hiring agents: Technical Agent, HR/Culture Agent, Hiring Manager Agent, and Skeptic Agent.
You will receive the Candidate Profile and the initial independent opinions of all four agents.
Your goal is to simulate a multi-turn, structured debate where:
1. Each agent speaks in turn, adopting their specific persona.
2. The speaker must directly react to at least one point, quote, or claim raised by another agent.
3. The speaker can agree, disagree, or revise their score/opinion.
4. CRITICAL: At least one agent's score/opinion MUST change as a result of another agent's argument. For example, the Technical Agent might lower their score after the Skeptic highlights a critical contradiction in the transcript, or the Hiring Manager might adjust their score based on HR's teamwork analysis. This score change must be traceable in the 'new_position.score' vs 'original_position.score'.
5. Ground all debate opinions strictly on the candidate profile data. Do not hallucinate or invent new interview events.${transcriptDebateRule}`;

  const prompt = `Here is the Candidate Profile:
---
${JSON.stringify(profile, null, 2)}
---

Here are the initial independent opinions of the 4 agents:
---
TECHNICAL AGENT:
Score: ${opinions.technical.score}/10, Confidence: ${opinions.technical.confidence}/5
Opinion: ${opinions.technical.opinion}
Evidence: ${JSON.stringify(opinions.technical.evidence)}
Gaps: ${opinions.technical.gaps}

HR/CULTURE AGENT:
Score: ${opinions.hr_culture.score}/10, Confidence: ${opinions.hr_culture.confidence}/5
Opinion: ${opinions.hr_culture.opinion}
Evidence: ${JSON.stringify(opinions.hr_culture.evidence)}
Gaps: ${opinions.hr_culture.gaps}

HIRING MANAGER AGENT:
Score: ${opinions.hiring_manager.score}/10, Confidence: ${opinions.hiring_manager.confidence}/5
Opinion: ${opinions.hiring_manager.opinion}
Evidence: ${JSON.stringify(opinions.hiring_manager.evidence)}
Gaps: ${opinions.hiring_manager.gaps}

SKEPTIC AGENT:
Score: ${opinions.skeptic.score}/10, Confidence: ${opinions.skeptic.confidence}/5
Opinion: ${opinions.skeptic.opinion}
Evidence: ${JSON.stringify(opinions.skeptic.evidence)}
Gaps: ${opinions.skeptic.gaps}
---

Simulate the debate in 4 distinct turns (e.g. Turn 1: Skeptic, Turn 2: Technical, Turn 3: HR, Turn 4: Hiring Manager). Ensure at least one agent changes their position/score. Return the output in the specified JSON structure.`;

  try {
    const debate = await callGemini({
      prompt,
      systemInstruction,
      jsonMode: true,
      jsonSchema: DEBATE_SCHEMA
    });

    // Write to cache
    fs.writeFileSync(cacheFile, JSON.stringify(debate, null, 2), 'utf-8');
    console.log(`[Cache Write] Saved debate log for Candidate ${candidateId}`);
    return debate;
  } catch (error) {
    console.error(`Error running debate for Candidate ${candidateId}:`, error);
    throw error;
  }
}
