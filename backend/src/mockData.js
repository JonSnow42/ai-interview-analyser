export const MOCK_CANDIDATES = {
  A: {
    profile: {
      name: "Rohan Malhotra",
      years_of_experience: 3.5,
      skills_claimed: [
        { skill: "Python", years_of_experience: 3.5, context: "Primary language used across all roles at Nimbus, Quickship, and Voltrix." },
        { skill: "FastAPI", years_of_experience: 2, context: "Used at Nimbus and Voltrix for building backend services and APIs." },
        { skill: "LangGraph / CrewAI", years_of_experience: 0.6, context: "Used at Voltrix Logistics for multi-agent exception handling engine." },
        { skill: "RAG / Vector Search", years_of_experience: 1.5, context: "Built RAG pipelines over carrier rate documents using LangChain + Pinecone at Quickship." }
      ],
      specific_claims: [
        { claim: "Sole architect of the retry/escalation logic now running in production, handling 5,000+ freight exceptions/month", evidence: "Resume bullet 3: 'Sole architect of the retry/escalation logic now running in production...'" },
        { claim: "Designed exception-handling engine cutting review time by 40%", evidence: "Resume bullet 1: 'Designed and built the exception-handling engine... cutting manual exception review time by 40%.'" }
      ],
      notable_quotes: [
        { quote: "Rules don’t scale. Too many failure types — timeouts, bad EDI, missing BOL fields. Agents handle that better.", context: "Answering why they chose a multi-agent structure over a rule-based system." },
        { quote: "Fine — 'sole architect' is probably too strong. I led the design, she built most of the production version.", context: "Admitting to the Skeptic Agent's follow-up question regarding collaboration with Priya." },
        { quote: "Better pay and title, mostly. Voltrix is more aligned with what I want long-term.", context: "Explaining why he had three roles in 3.5 years." }
      ]
    },
    opinions: {
      technical: {
        agentName: "Technical Agent",
        score: 8,
        confidence: 4,
        opinion: "Rohan has direct, hands-on experience building multi-agent LLM systems with LangGraph and CrewAI. He designed a planner-executor-reviewer pattern which maps closely to our tech stack requirements. He understands model routing and cost trade-offs between SLMs and GPT-4.",
        evidence: [
          { quote: "Designed and built the exception-handling engine end-to-end for Voltrix’s multi-agent freight ops platform", source: "Resume" },
          { quote: "Rules don’t scale. Too many failure types... Agents handle that better.", source: "Transcript Q2" }
        ],
        gaps: "Did not specify the exact performance benchmarks or override rates for his exception-handling engine."
      },
      hr_culture: {
        agentName: "HR/Culture Agent",
        score: 5,
        confidence: 4,
        opinion: "Rohan communicates with confidence but shows potential flags around retention and teamwork. He has changed jobs three times in 3.5 years, admitting it was driven by pay and title, which raises concerns about long-term commitment. Furthermore, his initial exaggeration of his role in the Voltrix project suggests a potential issue with crediting team members.",
        evidence: [
          { quote: "Better pay and title, mostly.", source: "Transcript Q10" },
          { quote: "Fine — 'sole architect' is probably too strong.", source: "Transcript Q7" }
        ],
        gaps: "Hard to assess long-term collaboration skills beyond his work with Priya."
      },
      hiring_manager: {
        agentName: "Hiring Manager Agent",
        score: 6,
        confidence: 4,
        opinion: "Rohan will require minimal ramp-up time for our immediate project needs, which is a major advantage. However, his tenure at previous companies is extremely short (under a year for the last two roles). I am concerned about his readiness to take on long-term production reliability and on-call rotation, given the small scale of his previous production system.",
        evidence: [
          { quote: "Voltrix’s user base is still small, so I haven’t seen serious incident volume yet.", source: "Transcript Q9" },
          { quote: "Senior AI Engineer — Voltrix Logistics Tech (7 months)", source: "Resume" }
        ],
        gaps: "Ability to handle high-stress production outages remains unproven."
      },
      skeptic: {
        agentName: "Skeptic Agent",
        score: 4,
        confidence: 5,
        opinion: "Rohan's resume contains active exaggerations. He claims to be the 'sole architect' of the exception engine, yet admitted that Priya built most of the production code. This is a critical honesty and integrity concern. Additionally, his model routing was done 'as things broke' rather than through systematic evaluation, suggesting unstructured engineering practices.",
        evidence: [
          { quote: "Fine — 'sole architect' is probably too strong. I led the design, she built most of the production version.", source: "Transcript Q7" },
          { quote: "No formal study, just tuned it as things broke.", source: "Transcript Q4" }
        ],
        gaps: "Unclear how much of the actual coding and system optimization was done by Rohan versus his teammates."
      }
    },
    debate: {
      debate_interactions: [
        {
          agent: "Skeptic Agent",
          reacting_to: "Technical Agent",
          original_position: { score: 4, opinion: "Rohan exaggerated his resume claims. He is not a sole architect." },
          new_position: { score: 4, opinion: "I maintain that Rohan's technical depth is questionable since he did not write the production implementation of the exception engine." },
          reason_for_change_or_holding: "The Technical Agent rated him an 8 based on 'hands-on experience', but the transcript proves Rohan's hands-on production coding for this engine was minimal, with Priya doing most of the work."
        },
        {
          agent: "Technical Agent",
          reacting_to: "Skeptic Agent",
          original_position: { score: 8, opinion: "Rohan has direct, hands-on experience building multi-agent LLM systems." },
          new_position: { score: 6, opinion: "I am revising my score down from 8 to 6. Skeptic Agent is correct that Rohan exaggerated. If he only designed the logic but didn't write the production version, his hands-on coding depth in multi-agent systems is unverified." },
          reason_for_change_or_holding: "Skeptic's point highlighted that Priya did the bulk of the production work. Thus, Rohan's claims of shipping production-ready multi-agent code are overstated."
        },
        {
          agent: "HR/Culture Agent",
          reacting_to: "Technical Agent",
          original_position: { score: 5, opinion: "Concerns about job hopping and claiming sole credit." },
          new_position: { score: 5, opinion: "I hold my score at 5. The Technical Agent's downgrade confirms that the resume embellishment has real implications for both technical ability and integrity." },
          reason_for_change_or_holding: "The resume exaggeration is not just a soft-skills concern; it actively masked a gap in hands-on implementation details."
        },
        {
          agent: "Hiring Manager Agent",
          reacting_to: "Technical Agent",
          original_position: { score: 6, opinion: "Rohan requires minimal ramp-up but has tenure concerns." },
          new_position: { score: 5, opinion: "I will lower my score to 5. If the Technical Agent is now less confident in his coding depth, the argument that Rohan will require 'minimal ramp-up' no longer holds." },
          reason_for_change_or_holding: "Rohan's primary value proposition was immediate productivity. With that called into question due to the design-vs-implementation split, his job-hopping history makes him a much higher risk."
        }
      ]
    },
    decision: {
      recommendation: "No Hire",
      confidence: 4,
      rationale: "Rohan Malhotra has a strong profile on paper but the interview revealed critical integrity and experience concerns. He claimed to be the 'sole architect' of his company's core agent engine, which was debunked in the interview when he admitted a colleague (Priya) did most of the actual production building. Because of this, his technical depth is unverified, and his primary selling point (immediate productivity) is compromised. When combined with his job-hopping pattern (3 jobs in 3.5 years, each under a year) and lack of experience with high incident volumes, the panel recommends a 'No Hire'.",
      decisive_evidence: [
        { quote: "Fine — 'sole architect' is probably too strong. I led the design, she built most of the production version.", source: "Transcript Q7", agent_origin: "Skeptic Agent" },
        { quote: "Better pay and title, mostly. Voltrix is more aligned with what I want long-term.", source: "Transcript Q10", agent_origin: "HR/Culture Agent" },
        { quote: "Voltrix’s user base is still small, so I haven’t seen serious incident volume yet.", source: "Transcript Q9", agent_origin: "Hiring Manager Agent" }
      ],
      agent_weights: [
        { agent: "Skeptic Agent", weight: "High", reason: "Uncovered the crucial mismatch between resume claims and actual project execution, which changed the entire panel's trajectory." },
        { agent: "Technical Agent", weight: "Medium", reason: "Correctly adjusted their score downwards once the exaggeration was exposed." },
        { agent: "HR/Culture Agent", weight: "High", reason: "Evaluated the career stability risk which is critical for a startup needing long-term ownership." },
        { agent: "Hiring Manager Agent", weight: "Medium", reason: "Weighed business risk and ramp-up timeline appropriately." }
      ]
    }
  },
  B: {
    profile: {
      name: "Ananya Iyer",
      years_of_experience: 6,
      skills_claimed: [
        { skill: "Python", years_of_experience: 6, context: "Used continuously at Bridgepoint Systems for junior backend developer and SWE II roles." },
        { skill: "FastAPI / REST APIs", years_of_experience: 4, context: "Built and maintained microservices and internal tool REST APIs at Bridgepoint." },
        { skill: "LangChain / Chroma Vector Store", years_of_experience: 1.5, context: "Built an internal support-ticket RAG assistant." },
        { skill: "OCR Pipelines (Tesseract)", years_of_experience: 1, context: "Migrated part of document ingestion pipeline to OCR-based extraction." }
      ],
      specific_claims: [
        { claim: "Support-ticket RAG assistant improved answer accuracy by around 40%", evidence: "Resume: 'team estimated answer accuracy improved by around 40% based on informal review.'" },
        { claim: "Introduced a pre-deploy checklist for prompt changes that the team adopted", evidence: "Resume: 'introduced a pre-deploy checklist for prompt changes that the team adopted.'" }
      ],
      notable_quotes: [
        { quote: "I want to be upfront about this — it was based on internal review, not a formal benchmark... I wouldn’t want to present that number as something rigorous.", context: "Answering how the 40% accuracy improvement was measured." },
        { quote: "Not in production... toy project on my own time... That’s a real gap relative to what this role needs, and I’d rather say that clearly than talk around it.", context: "Admitting she has not used multi-agent frameworks in production." },
        { quote: "First, I ran an incident retro with the team and was direct that it was my mistake in the writeup — I didn’t want to soften that.", context: "Describing how she handled pushing a bad prompt change to production." },
        { quote: "I’m a safer bet on the production-ownership side — I’ve been through a real incident and changed how the team works because of it.", context: "Explaining why the company should hire her over someone with existing multi-agent experience." }
      ]
    },
    opinions: {
      technical: {
        agentName: "Technical Agent",
        score: 4,
        confidence: 5,
        opinion: "Ananya has no production experience with multi-agent orchestration frameworks like LangGraph or CrewAI. Her AI experience is limited to single-agent RAG. While she has built a small toy project, this role requires day-one capability to write complex multi-agent architectures, which she lacks.",
        evidence: [
          { quote: "Not in production. I’ve read through the docs... but everything I’ve actually shipped has been single-agent RAG.", source: "Transcript Q3" }
        ],
        gaps: "Lacks any hands-on production experience in multi-agent scheduling, review patterns, or conflict resolution."
      },
      hr_culture: {
        agentName: "HR/Culture Agent",
        score: 9,
        confidence: 5,
        opinion: "Ananya displays exceptional honesty, integrity, and self-awareness. She was immediately upfront about the limitations of her 40% accuracy claim. Furthermore, her response to her production mistake—taking full responsibility, writing an incident retro, and implementing a pre-deploy checklist—is a textbook example of high maturity, accountability, and strong culture fit.",
        evidence: [
          { quote: "I want to be upfront about this... I wouldn’t want to present that number as something rigorous", source: "Transcript Q2" },
          { quote: "I ran an incident retro with the team and was direct that it was my mistake in the writeup", source: "Transcript Q5" }
        ],
        gaps: "None identified. Her behavioral signals are outstanding."
      },
      hiring_manager: {
        agentName: "Hiring Manager Agent",
        score: 7,
        confidence: 4,
        opinion: "Ananya has a strong 6-year history of steady growth at a single company. She has adapted from junior backend work to leading OCR and AI integrations. Her proactive attitude toward learning and willingness to pair and ask for help suggests she will ramp up quickly despite the multi-agent experience gap.",
        evidence: [
          { quote: "I went from junior backend work, to leading a pipeline migration, to driving our team’s move into AI.", source: "Transcript Q10" },
          { quote: "I tend to ask for help early instead of quietly struggling", source: "Transcript Q8" }
        ],
        gaps: "Will require a mentor and active pairing to ramp up on multi-agent patterns initially."
      },
      skeptic: {
        agentName: "Skeptic Agent",
        score: 7,
        confidence: 4,
        opinion: "I actively searched for flags or inconsistencies but found none. Ananya's claims are completely grounded. She immediately deflates her own resume metric (40% accuracy improvement) as informal and calls out her own technical gap. This level of candor is rare and highly valuable.",
        evidence: [
          { quote: "That’s a real gap relative to what this role needs, and I’d rather say that clearly than talk around it.", source: "Transcript Q3" },
          { quote: "I didn’t try to shift blame for the specific incident onto the process gap.", source: "Transcript Q7" }
        ],
        gaps: "The technical gap in multi-agent orchestration remains the only concern, but it is not a deception flag."
      }
    },
    debate: {
      debate_interactions: [
        {
          agent: "Hiring Manager Agent",
          reacting_to: "Technical Agent",
          original_position: { score: 7, opinion: "Ananya has a solid backend foundation and can ramp up on agent frameworks." },
          new_position: { score: 7, opinion: "I agree with Technical Agent that the multi-agent gap is real. However, her plan to pair and read existing code directly rather than general courses shows a very pragmatic approach to learning." },
          reason_for_change_or_holding: "Her learning framework is targeted at production systems, which mitigates the risk of her lack of framework experience."
        },
        {
          agent: "Technical Agent",
          reacting_to: "Hiring Manager Agent",
          original_position: { score: 4, opinion: "She lacks production multi-agent experience and cannot start on day one." },
          new_position: { score: 6, opinion: "I will revise my score from 4 to 6. Hiring Manager and HR make a strong case. Her solid 6-year backend background (FastAPI, databases, OCR pipelines) means she is a highly competent software engineer. Adapting to LangGraph will be straightforward for someone of her caliber who asks for help early." },
          reason_for_change_or_holding: "Her foundational software engineering skills are deep (6 years at one place), and she has successfully migrated pipelines before. A solid backend engineer who is honest about gaps is easier to ramp up than someone who exaggerates."
        },
        {
          agent: "HR/Culture Agent",
          reacting_to: "Technical Agent",
          original_position: { score: 9, opinion: "Outstanding integrity and culture fit." },
          new_position: { score: 9, opinion: "I hold my score at 9. The Technical Agent's score revision shows that her honesty and core engineering skills are recognized as strong assets that compensate for the tool gap." },
          reason_for_change_or_holding: "Integrity and accountability are core to our engineering team culture and cannot be easily taught, whereas a framework can be learned in a few weeks."
        },
        {
          agent: "Skeptic Agent",
          reacting_to: "Technical Agent",
          original_position: { score: 7, opinion: "Candidate is highly transparent, no red flags found." },
          new_position: { score: 7, opinion: "I hold my score at 7. Technical Agent's score increase is logical. Having a developer who owns mistakes and implements process checklists prevents critical outages, which is a massive asset." },
          reason_for_change_or_holding: "Her response to the prompt incident shows she understands software delivery guardrails, which is critical for agentic systems."
        }
      ]
    },
    decision: {
      recommendation: "Hire",
      confidence: 4,
      rationale: "The panel recommends hiring Ananya Iyer for the AI Engineer role. Although she lacks production experience with multi-agent orchestration frameworks (like LangGraph), she possesses a very strong software engineering foundation (6 years at Bridgepoint Systems, handling FastAPI, databases, and OCR pipelines) and a proven record of picking up new technologies quickly. What set her apart was her exceptional honesty, self-awareness, and mature approach to production reliability. She owned her past production mistakes directly and proactively introduced checklists to prevent future incidents. In contrast to candidates who exaggerate their experience, Ananya is highly transparent and a safer, more reliable long-term hire for our core systems.",
      decisive_evidence: [
        { quote: "First, I ran an incident retro with the team and was direct that it was my mistake in the writeup — I didn’t want to soften that.", source: "Transcript Q5", agent_origin: "HR/Culture Agent" },
        { quote: "I’m a safer bet on the production-ownership side — I’ve been through a real incident and changed how the team works because of it", source: "Transcript Q9", agent_origin: "Hiring Manager Agent" },
        { quote: "I went from junior backend work, to leading a pipeline migration, to driving our team’s move into AI.", source: "Transcript Q10", agent_origin: "Hiring Manager Agent" }
      ],
      agent_weights: [
        { agent: "HR/Culture Agent", weight: "High", reason: "Highlighted outstanding behavioral patterns, accountability, and error-handling maturity." },
        { agent: "Technical Agent", weight: "High", reason: "Evaluated backend depth and validated that her lack of LangGraph experience can be overcome quickly due to strong software engineering fundamentals." },
        { agent: "Hiring Manager Agent", weight: "High", reason: "Correctly identified that her long-term ownership and growth potential make her an excellent fit for startup scaling." },
        { agent: "Skeptic Agent", weight: "Medium", reason: "Audited candidate claims and confirmed zero deception, boosting team confidence." }
      ]
    }
  }
};
