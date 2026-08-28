import streamlit as st
import os
import json
import dotenv
from pypdf import PdfReader
from typing import TypedDict, List
import google.generativeai as genai
from concurrent.futures import ThreadPoolExecutor

# Page Configuration
st.set_page_config(
    page_title="AI Interview Panel Simulator",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Load environment variables
dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), "backend/.env"))

# Determine default credentials
default_key = os.getenv("GEMINI_API_KEY", "")
default_model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

# Session State Initialization
if "api_key" not in st.session_state:
    st.session_state.api_key = default_key
if "model_name" not in st.session_state:
    st.session_state.model_name = default_model
if "pipeline_results" not in st.session_state:
    st.session_state.pipeline_results = None

# Custom CSS for Premium Design Aesthetics
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Plus Jakarta Sans', sans-serif;
    }
    h1, h2, h3, h4, h5, h6 {
        font-family: 'Outfit', sans-serif;
    }
    
    /* Background Glow */
    .stApp {
        background: radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.15), transparent 50%),
                    radial-gradient(circle at 20% 80%, rgba(244, 63, 94, 0.08), transparent 50%),
                    #0b0f19;
        color: #f1f5f9;
    }
    
    /* Header controls */
    .app-header {
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: 1.5rem;
        margin-bottom: 2rem;
    }
    
    /* Verdict Cards */
    .verdict-card {
        padding: 1.5rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .verdict-hire {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.03));
        border-color: rgba(16, 185, 129, 0.3);
        box-shadow: 0 0 20px rgba(16, 185, 129, 0.05);
    }
    .verdict-no-hire {
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.03));
        border-color: rgba(239, 68, 68, 0.3);
        box-shadow: 0 0 20px rgba(239, 68, 68, 0.05);
    }
    .verdict-borderline {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.03));
        border-color: rgba(245, 158, 11, 0.3);
        box-shadow: 0 0 20px rgba(245, 158, 11, 0.05);
    }
    
    /* Star Rating */
    .star-filled {
        color: #fbbf24;
        font-weight: bold;
    }
    .star-empty {
        color: #4b5563;
    }
    
    /* Badges */
    .badge-status {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.25rem 0.6rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        border: 1px solid transparent;
    }
    .badge-active {
        background: rgba(52, 211, 153, 0.1);
        color: #34d399;
        border-color: rgba(52, 211, 153, 0.2);
    }
    .badge-warning {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border-color: rgba(245, 158, 11, 0.3);
    }
    
    /* Strengths and Concerns Card columns */
    .point-card {
        padding: 1.25rem;
        border-radius: 10px;
        height: 100%;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .point-card.strength {
        background: rgba(16, 185, 129, 0.02);
        border-left: 4px solid #10b981;
    }
    .point-card.concern {
        background: rgba(239, 68, 68, 0.02);
        border-left: 4px solid #ef4444;
    }
    .point-item {
        font-size: 0.88rem;
        line-height: 1.5;
        margin-bottom: 0.75rem;
        background: rgba(255, 255, 255, 0.02);
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.04);
        cursor: pointer;
        transition: background 0.2s;
    }
    .point-item:hover {
        background: rgba(255, 255, 255, 0.04);
    }
    
    /* Timeline debate styles */
    .debate-turn-container {
        border-left: 2px solid rgba(255, 255, 255, 0.08);
        padding-left: 1.5rem;
        margin-left: 0.5rem;
        margin-bottom: 1.5rem;
        position: relative;
    }
    .debate-turn-node {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #6366f1;
        position: absolute;
        left: -7px;
        top: 6px;
        box-shadow: 0 0 10px #6366f1;
    }
    .debate-card {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        padding: 1rem 1.25rem;
        border-radius: 8px;
    }
    .debate-shift-glow {
        border: 1px solid rgba(245, 158, 11, 0.2);
        box-shadow: 0 0 15px rgba(245, 158, 11, 0.06);
        background: rgba(245, 158, 11, 0.02);
    }
    
    /* Before/After score transition row */
    .score-shift-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0.5rem 0;
    }
    .score-badge {
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: bold;
    }
    .score-before {
        background: rgba(255, 255, 255, 0.1);
        color: #9ca3af;
    }
    .score-after {
        background: rgba(245, 158, 11, 0.2);
        color: #fbbf24;
    }
</style>
""", unsafe_allow_html=True)

# ----------------- Schemas -----------------
class SkillClaimed(TypedDict):
    skill: str
    years_of_experience: float
    context: str

class SpecificClaim(TypedDict):
    claim: str
    evidence: str

class NotableQuote(TypedDict):
    quote: str
    context: str

class CandidateProfile(TypedDict):
    name: str
    years_of_experience: float
    skills_claimed: List[SkillClaimed]
    specific_claims: List[SpecificClaim]
    notable_quotes: List[NotableQuote]
    transcript_provided: bool

class Evidence(TypedDict):
    quote: str
    source: str

class AgentAppraisal(TypedDict):
    agentName: str
    score: float
    confidence: float
    opinion: str
    evidence: List[Evidence]
    gaps: str

class Position(TypedDict):
    score: float
    opinion: str

class DebateTurn(TypedDict):
    agent: str
    reacting_to: str
    original_position: Position
    new_position: Position
    reason_for_change_or_holding: str

class DebateLog(TypedDict):
    debate_interactions: List[DebateTurn]

class DecisiveEvidence(TypedDict):
    quote: str
    source: str
    agent_origin: str

class AgentWeight(TypedDict):
    agent: str
    weight: str
    reason: str

class FinalDecision(TypedDict):
    recommendation: str
    confidence: float
    rationale: str
    decisive_evidence: List[DecisiveEvidence]
    agent_weights: List[AgentWeight]

# ----------------- LLM Runner Functions -----------------
def call_gemini(prompt: str, system_instruction: str, json_schema=None) -> dict:
    genai.configure(api_key=st.session_state.api_key)
    
    config = {}
    if json_schema:
        config["response_mime_type"] = "application/json"
        config["response_schema"] = json_schema

    model = genai.GenerativeModel(
        model_name=st.session_state.model_name,
        generation_config=config,
        system_instruction=system_instruction
    )
    
    response = model.generate_content(prompt)
    
    if json_schema:
        return json.loads(response.text)
    return response.text

# ----------------- Pipeline Functions -----------------
def parse_pdf(uploaded_file) -> str:
    if uploaded_file is None:
        return ""
    reader = PdfReader(uploaded_file)
    text = ""
    for page in reader.pages:
        t = page.extract_text()
        if t:
            text += t + "\n"
    return text

def build_profile(candidate_name: str, resume_text: str, transcript_text: str = "") -> dict:
    has_transcript = len(transcript_text.strip()) > 0

    quote_rule = ""
    if not has_transcript:
        quote_rule = "\n4. CRITICAL RULE (Resume-Only Mode): Because no interview transcript was provided, notable_quotes must be returned as an EMPTY array []. Do not make up or extract quotes from the resume as interview quotes."

    system_instruction = f"""You are an expert Talent Acquisition Profile Builder.
Your role is to analyze a candidate's resume and optional interview transcript to produce a structured JSON profile.
Be highly accurate. Extract only verifiable claims and support them with verbatim quotes.
Ensure all extracted years of experience are represented as floats.
Set the transcript_provided field to {"true" if has_transcript else "false"}.{quote_rule}"""

    prompt = f"""Please analyze the following details for Candidate: {candidate_name}.

RESUME CONTENT:
---
{resume_text}
---

INTERVIEW TRANSCRIPT CONTENT:
---
{transcript_text if has_transcript else "(No interview transcript provided)"}
---

Produce the profile JSON matching the schema requirements."""

    return call_gemini(prompt, system_instruction, CandidateProfile)

def evaluate_agent(candidate_name: str, profile: dict, agent_key: str, agent_name: str, jd_text: str) -> dict:
    transcript_rule = ""
    if not profile.get("transcript_provided", False):
        transcript_rule = f"""\n6. CRITICAL EVALUATION RULE (Resume-Only Mode): The interview transcript was not provided (transcript_provided is false). Because of this, you MUST explicitly state in your gaps section and your opinion which qualities or technical competencies (e.g. communication style, collaborative ability, live technical explanation) you cannot verify without a transcript. Do not guess or infer verbal abilities. Restrict your score to only what is verifiable. Reduce your confidence score (typically to 1 or 2 out of 5) to reflect the lack of live evaluation data."""

    agent_roles = {
        "technical": "Technical Agent - focusing on engineering skills, technical depth, system design capabilities, and hands-on coding experience.",
        "hr_culture": "HR/Culture Agent - focusing on teamwork, cultural fit, alignment with values, communication skill, and career growth potential.",
        "hiring_manager": "Hiring Manager Agent - focusing on product delivery capability, strategic problem solving, team leadership, and overall business value.",
        "skeptic": "Skeptic Agent - whose job is to actively search for red flags, inconsistencies, gaps in resume/transcript claims, or over-exaggerated credentials."
    }

    system_instruction = f"""You are the {agent_roles.get(agent_key, agent_name)} on an interview panel.
Your task is to review the Candidate Profile and the Job Description, and provide your initial, independent scorecard.
Provide a score (1-10) and confidence (1-5), a clear opinion, verbatim quote evidence with its source, and a summary of gaps.
You must ground all evidence strictly on the provided Candidate Profile. Do not make up quotes.{transcript_rule}"""

    prompt = f"""Here is the Job Description:
---
{jd_text}
---

Here is the Candidate Profile:
---
{json.dumps(profile, indent=2)}
---

Evaluate the candidate and return the initial scorecard JSON."""

    return call_gemini(prompt, system_instruction, AgentAppraisal)

def run_debate(candidate_name: str, profile: dict, opinions: dict) -> dict:
    transcript_debate_rule = ""
    if not profile.get("transcript_provided", False):
        transcript_debate_rule = """\n6. CRITICAL DEBATE RULE (Resume-Only Mode): The candidate's interview transcript was not provided (transcript_provided is false). During this debate, the agents MUST actively raise the lack of transcript evidence as a key debate point. The agents should critique each other's scores by emphasizing that core behavioral qualities, teamwork capabilities, live technical reasoning, and veracity of claims remain completely unverified. They should debate the risk of recommending a hire based purely on resume claims without any live interview data."""

    system_instruction = f"""You are a Hiring Panel Moderator. You are moderating a structured debate among four hiring agents: Technical Agent, HR/Culture Agent, Hiring Manager Agent, and Skeptic Agent.
You will receive the Candidate Profile and the initial independent opinions of all four agents.
Your goal is to simulate a multi-turn, structured debate where:
1. Each agent speaks in turn, adopting their specific persona.
2. The speaker must directly react to at least one point, quote, or claim raised by another agent.
3. The speaker can agree, disagree, or revise their score/opinion.
4. CRITICAL: At least one agent's score/opinion MUST change as a result of another agent's argument. For example, the Technical Agent might lower their score after the Skeptic highlights a critical contradiction, or the Hiring Manager might adjust their score based on HR's teamwork analysis. This score change must be traceable in the 'new_position.score' vs 'original_position.score'.
5. Ground all debate opinions strictly on the candidate profile data. Do not hallucinate or invent new interview events.{transcript_debate_rule}"""

    opinions_str = f"""
TECHNICAL AGENT:
Score: {opinions['technical']['score']}/10, Confidence: {opinions['technical']['confidence']}/5
Opinion: {opinions['technical']['opinion']}
Evidence: {json.dumps(opinions['technical']['evidence'])}
Gaps: {opinions['technical']['gaps']}

HR/CULTURE AGENT:
Score: {opinions['hr_culture']['score']}/10, Confidence: {opinions['hr_culture']['confidence']}/5
Opinion: {opinions['hr_culture']['opinion']}
Evidence: {json.dumps(opinions['hr_culture']['evidence'])}
Gaps: {opinions['hr_culture']['gaps']}

HIRING MANAGER AGENT:
Score: {opinions['hiring_manager']['score']}/10, Confidence: {opinions['hiring_manager']['confidence']}/5
Opinion: {opinions['hiring_manager']['opinion']}
Evidence: {json.dumps(opinions['hiring_manager']['evidence'])}
Gaps: {opinions['hiring_manager']['gaps']}

SKEPTIC AGENT:
Score: {opinions['skeptic']['score']}/10, Confidence: {opinions['skeptic']['confidence']}/5
Opinion: {opinions['skeptic']['opinion']}
Evidence: {json.dumps(opinions['skeptic']['evidence'])}
Gaps: {opinions['skeptic']['gaps']}
"""

    prompt = f"""Here is the Candidate Profile:
---
{json.dumps(profile, indent=2)}
---

Here are the initial independent opinions of the 4 agents:
---
{opinions_str}
---

Simulate the debate in 4 distinct turns (e.g. Turn 1: Skeptic, Turn 2: Technical, Turn 3: HR, Turn 4: Hiring Manager). Ensure at least one agent changes their position/score. Return the output in the specified JSON structure."""

    return call_gemini(prompt, system_instruction, DebateLog)

def run_decision(candidate_name: str, profile: dict, opinions: dict, debate: dict) -> dict:
    decision_instruction = ""
    if not profile.get("transcript_provided", False):
        decision_instruction = """\n7. CRITICAL JUDGE RULE (Resume-Only Mode): The candidate's interview transcript was not provided (transcript_provided is false). Your final recommendation is based entirely on a resume-only evaluation. Your rationale must explicitly note that this is a resume-only evaluation, and that the panel's confidence is inherently lower (typically 1 or 2 out of 5) because verbal ability, communication, integrity, and direct verification of resume achievements remain unassessed. You MUST explicitly recommend that a formal interview be conducted before making a final hire/no-hire decision."""

    system_instruction = f"""You are the Hiring Panel Judge / Lead Architect. Your role is to analyze the entire evaluation lifecycle of a candidate (independent agent assessments + debate outcomes) and render a final hiring decision.
You must NOT simply average the scores. Instead:
1. Review the initial independent scores, confidence levels, and GAPs of all 4 agents.
2. Review how they debated, and whether any agent revised their position (e.g. lowering or raising their score based on arguments/evidence).
3. Evaluate which evidence is most credible, rigorous, and relevant to the Job Description.
4. Assign qualitative weights (High/Medium/Low) to each agent's opinion, providing explicit reasons.
5. Render a final decision: "Hire", "No Hire", or "Borderline", along with a confidence level (1-5) and a written rationale citing the decisive evidence.
6. Ensure all decisive evidence is grounded in real, verbatim quotes with their source and agent origin.{decision_instruction}"""

    prompt = f"""Please review the full hiring process for Candidate: {profile['name']}.
Candidate Profile:
---
{json.dumps(profile, indent=2)}
---

Independent Agent Opinions:
---
{json.dumps(opinions, indent=2)}
---

Debate Interactions:
---
{json.dumps(debate, indent=2)}
---

Provide your final decision, confidence score, rationale, decisive evidence, and agent weights in the required JSON format."""

    return call_gemini(prompt, system_instruction, FinalDecision)

# ----------------- Sidebar Configurations -----------------
with st.sidebar:
    st.image("frontend/public/favicon.svg" if os.path.exists("frontend/public/favicon.svg") else "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/briefcase.svg", width=50)
    st.title("Simulator Config")
    
    st.subheader("Credentials")
    key_input = st.text_input("Gemini API Key", value=st.session_state.api_key, type="password")
    if key_input:
        st.session_state.api_key = key_input
        
    model_input = st.text_input("Gemini Model", value=st.session_state.model_name)
    if model_input:
        st.session_state.model_name = model_input
        
    st.markdown("---")
    
    # Reset State Button
    if st.session_state.pipeline_results is not None:
        if st.button("Reset Evaluation & Upload New"):
            st.session_state.pipeline_results = None
            st.rerun()

# ----------------- UI Layout / Execution Stage -----------------

st.markdown('<div class="app-header">', unsafe_allow_html=True)
st.title("AI Interview Panel Simulator")
st.write("Multi-agent evaluation, debate, and consensus decision pipeline built with Gemini")
st.markdown('</div>', unsafe_allow_html=True)

# Connection Status Badge
is_connected = len(st.session_state.api_key.strip()) > 0
if is_connected:
    st.markdown('<span class="badge-status badge-active">Gemini Live Enabled</span>', unsafe_allow_html=True)
else:
    st.markdown('<span class="badge-status" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">Gemini Config Error / Missing Key</span>', unsafe_allow_html=True)

st.write("")

if st.session_state.pipeline_results is None:
    # ----------------- Stage 0: File Upload Form -----------------
    st.markdown("### Upload Interview Materials")
    st.write("Select the Job Description and candidate resumes. Interview transcripts are optional.")
    
    with st.form("pipeline_upload_form"):
        col_jd = st.file_uploader("1. Job Description (PDF) *", type=["pdf"])
        col_resA, col_resB = st.columns(2)
        col_trA, col_trB = st.columns(2)
        
        with col_resA:
            file_resA = st.file_uploader("2. Resume A (Rohan Malhotra) (PDF) *", type=["pdf"])
        with col_resB:
            file_resB = st.file_uploader("3. Resume B (Ananya Iyer) (PDF) *", type=["pdf"])
            
        with col_trA:
            file_trA = st.file_uploader("4. Interview Transcript A (PDF) (Optional)", type=["pdf"])
            if not file_trA:
                st.markdown('<div style="font-size: 0.78rem; color: #fbbf24; margin-top: 0.2rem;">⚠️ No transcript provided — evaluation will be based on resume only</div>', unsafe_allow_html=True)
        with col_trB:
            file_trB = st.file_uploader("5. Interview Transcript B (PDF) (Optional)", type=["pdf"])
            if not file_trB:
                st.markdown('<div style="font-size: 0.78rem; color: #fbbf24; margin-top: 0.2rem;">⚠️ No transcript provided — evaluation will be based on resume only</div>', unsafe_allow_html=True)
                
        submit_btn = st.form_submit_button("Run Evaluation Pipeline")
        
        if submit_btn:
            if not is_connected:
                st.error("Please configure a valid Gemini API Key in the sidebar or backend/.env file before running.")
            elif not col_jd or not file_resA or not file_resB:
                st.error("Job Description, Resume A, and Resume B are mandatory fields.")
            else:
                progress_container = st.empty()
                
                try:
                    with progress_container.container():
                        st.info("Parsing PDFs...")
                        jd_text = parse_pdf(col_jd)
                        resA_text = parse_pdf(file_resA)
                        resB_text = parse_pdf(file_resB)
                        trA_text = parse_pdf(file_trA) if file_trA else ""
                        trB_text = parse_pdf(file_trB) if file_trB else ""
                        
                        # Build Rohan Profile
                        st.info("Building Profile for Candidate A (Rohan Malhotra)...")
                        profile_A = build_profile("Rohan Malhotra", resA_text, trA_text)
                        
                        # Build Ananya Profile
                        st.info("Building Profile for Candidate B (Ananya Iyer)...")
                        profile_B = build_profile("Ananya Iyer", resB_text, trB_text)
                        
                        # Parallel Agent Evaluations
                        st.info("Running parallel multi-agent scorecards...")
                        
                        def run_agent_evals(candidate_name, profile):
                            agents = {
                                "technical": "Technical Agent",
                                "hr_culture": "HR/Culture Agent",
                                "hiring_manager": "Hiring Manager Agent",
                                "skeptic": "Skeptic Agent"
                            }
                            opinions = {}
                            
                            def single_worker(key, name):
                                return key, evaluate_agent(candidate_name, profile, key, name, jd_text)
                                
                            with ThreadPoolExecutor(max_workers=4) as executor:
                                futures = [executor.submit(single_worker, k, v) for k, v in agents.items()]
                                for fut in futures:
                                    k, res = fut.result()
                                    opinions[k] = res
                            return opinions
                            
                        opinions_A = run_agent_evals("Rohan Malhotra", profile_A)
                        opinions_B = run_agent_evals("Ananya Iyer", profile_B)
                        
                        # Debate Logs
                        st.info("Simulating panel debate for Rohan Malhotra...")
                        debate_A = run_debate("Rohan Malhotra", profile_A, opinions_A)
                        
                        st.info("Simulating panel debate for Ananya Iyer...")
                        debate_B = run_debate("Ananya Iyer", profile_B, opinions_B)
                        
                        # Final Consensus Decision Verdicts
                        st.info("Rendering final verdicts...")
                        decision_A = run_decision("Rohan Malhotra", profile_A, opinions_A, debate_A)
                        decision_B = run_decision("Ananya Iyer", profile_B, opinions_B, debate_B)
                        
                        st.success("Pipeline evaluation complete!")
                        
                    st.session_state.pipeline_results = {
                        "A": {
                            "profile": profile_A,
                            "opinions": opinions_A,
                            "debate": debate_A,
                            "decision": decision_A
                        },
                        "B": {
                            "profile": profile_B,
                            "opinions": opinions_B,
                            "debate": debate_B,
                            "decision": decision_B
                        }
                    }
                    st.rerun()
                    
                except Exception as e:
                    st.error(f"Pipeline Execution Failed: {str(e)}")

else:
    # ----------------- Dashboard Workspace -----------------
    results = st.session_state.pipeline_results
    
    # Candidate Selector
    cand_sel = st.radio(
        "Select Candidate to Review:",
        ["Candidate A (Rohan Malhotra)", "Candidate B (Ananya Iyer)"],
        horizontal=True
    )
    
    candidate_key = "A" if "Rohan" in cand_sel else "B"
    cand_data = results[candidate_key]
    
    profile = cand_data["profile"]
    opinions = cand_data["opinions"]
    debate = cand_data["debate"]
    decision = cand_data["decision"]
    
    # Top Status Info Bar
    c_p1, c_p2, c_p3 = st.columns([2, 2, 2])
    with c_p1:
        st.markdown(f"**Experience:** {profile.get('years_of_experience', 0)} Years")
    with c_p2:
        rec = decision.get("recommendation", "Borderline")
        st.markdown(f"**Panel Verdict:** `{rec.upper()}`")
    with c_p3:
        if not profile.get("transcript_provided", False):
            st.markdown('<span class="badge-status badge-warning">Resume-only evaluation</span>', unsafe_allow_html=True)
        else:
            st.markdown('<span class="badge-status badge-active">Transcript Evaluated</span>', unsafe_allow_html=True)
            
    st.write("")
    
    # Left Tabs Navigation
    tab_report, tab_profile, tab_opinions, tab_debate, tab_decision = st.tabs([
        "🏆 Final Evaluation Report",
        "📄 Stage 1: Candidate Profile",
        "✨ Stage 2: 4 Agent Opinions",
        "💬 Stage 3: Cross-Agent Debate",
        "⚖️ Stage 4: Judge Verdict Log"
    ])
    
    # TAB: Report View
    with tab_report:
        # Verdict Card styling
        v_class = "verdict-hire" if rec == "Hire" else "verdict-no-hire" if rec == "No Hire" else "verdict-borderline"
        
        stars_html = ""
        conf = int(decision.get("confidence", 3))
        for i in range(5):
            if i < conf:
                stars_html += '<span class="star-filled">★</span>'
            else:
                stars_html += '<span class="star-empty">☆</span>'
                
        warning_banner = ""
        if not profile.get("transcript_provided", False):
            warning_banner = """
            <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); padding: 0.75rem 1rem; borderRadius: 6px; color: #fbbf24; display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1.25rem; font-size: 0.85rem">
                ⚠️ <strong>Resume-Only Evaluation:</strong> No interview transcript was provided. Rationale is based purely on resume claims. Confidence is reduced.
            </div>
            """
            
        st.markdown(f"""
        <div class="verdict-card {v_class}">
            {warning_banner}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <div style="font-size: 0.8rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Consensus Recommendation</div>
                    <div style="font-size: 2rem; font-weight: 800; color: #ffffff;">{rec}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.8rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Panel Confidence</div>
                    <div style="font-size: 1.2rem; font-weight: bold; color: #fbbf24; margin-top: 0.2rem;">
                        {stars_html} ({conf}/5)
                    </div>
                </div>
            </div>
            <h4 style="color: #a5b4fc; margin-bottom: 0.5rem;">Consensus Rationale</h4>
            <p style="font-size: 0.9rem; line-height: 1.6; color: #d1d5db;">{decision.get('rationale', '')}</p>
        </div>
        """, unsafe_allow_html=True)
        
        # Helper to sort Strengths vs Concerns
        strengths = []
        concerns = []
        for k, o in opinions.items():
            if k == "skeptic":
                for ev in o.get("evidence", []):
                    concerns.append((o.get("agentName", "Skeptic"), ev))
            else:
                score = o.get("score", 0)
                if score >= 7:
                    for ev in o.get("evidence", []):
                        strengths.append((o.get("agentName", "Agent"), ev))
                elif 0 < score < 6:
                    for ev in o.get("evidence", []):
                        concerns.append((o.get("agentName", "Agent"), ev))
                        
        col_s, col_c = st.columns(2)
        
        with col_s:
            st.markdown('<div class="point-card strength">', unsafe_allow_html=True)
            st.markdown("##### ✅ Verified Strengths")
            if strengths:
                for agent, st_ev in strengths:
                    quote = st_ev.get("quote", "")
                    src = st_ev.get("source", "Profile")
                    st.markdown(f"""
                    <div class="point-item">
                        "{quote}"
                        <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.3rem;">
                            — {agent} ({src})
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
            else:
                st.write("*No high-confidence strengths verified.*")
            st.markdown('</div>', unsafe_allow_html=True)
            
        with col_c:
            st.markdown('<div class="point-card concern">', unsafe_allow_html=True)
            st.markdown("##### ⚠️ Concerns & Red Flags")
            if concerns:
                for agent, co_ev in concerns:
                    quote = co_ev.get("quote", "")
                    src = co_ev.get("source", "Profile")
                    st.markdown(f"""
                    <div class="point-item">
                        "{quote}"
                        <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.3rem;">
                            — {agent} ({src})
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
            else:
                st.write("*No red flags found in provided documents.*")
            st.markdown('</div>', unsafe_allow_html=True)
            
        st.write("")
        
        # Decisive Evidence List
        st.markdown("#### Decisive Evidence Citations")
        for dev in decision.get("decisive_evidence", []):
            st.info(f"\"{dev.get('quote', '')}\" \n\n— **{dev.get('agent_origin', '')}** (Source: *{dev.get('source', '')}*)")

    # TAB: Profile View
    with tab_profile:
        col_p1, col_p2 = st.columns(2)
        with col_p1:
            st.markdown("#### Professional Details")
            st.write(f"**Name:** {profile.get('name', '')}")
            st.write(f"**Years of Experience:** {profile.get('years_of_experience', 0)}")
            
            st.markdown("#### Skills & Context")
            for sk in profile.get("skills_claimed", []):
                st.markdown(f"""
                <div style="background: rgba(255,255,255,0.02); padding: 0.6rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 0.5rem;">
                    <strong>{sk.get('skill', '')}</strong> ({sk.get('years_of_experience', 0)} years)<br/>
                    <span style="font-size: 0.8rem; color: #9ca3af;">{sk.get('context', '')}</span>
                </div>
                """, unsafe_allow_html=True)
                
        with col_p2:
            st.markdown("#### Resume & Interview Claims")
            for cl in profile.get("specific_claims", []):
                st.markdown(f"""
                <div style="background: rgba(255,255,255,0.02); padding: 0.6rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 0.5rem; border-left: 3px solid #6366f1;">
                    <strong>Claim:</strong> {cl.get('claim', '')}<br/>
                    <span style="font-size: 0.8rem; color: #9ca3af; font-style: italic;">Evidence: "{cl.get('evidence', '')}"</span>
                </div>
                """, unsafe_allow_html=True)
                
            st.markdown("#### Key Interview Quotes")
            quotes = profile.get("notable_quotes", [])
            if quotes:
                for q in quotes:
                    st.markdown(f"*\"{q.get('quote', '')}\"* \n— Context: **{q.get('context', '')}**")
            else:
                st.write("*No interview transcript quotes available (Resume-only mode).*")

    # TAB: Isolated Opinions
    with tab_opinions:
        st.markdown("#### Isolated Agent Appraisals")
        st.write("Initial scores and appraisals generated in isolation prior to the panel debate.")
        
        col_a1, col_a2 = st.columns(2)
        col_a3, col_a4 = st.columns(2)
        
        cols = [col_a1, col_a2, col_a3, col_a4]
        for idx, (k, o) in enumerate(opinions.items()):
            with cols[idx]:
                st.markdown(f"""
                <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; height: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
                        <strong style="color: #a5b4fc; font-size: 1.1rem;">{o.get('agentName', 'Agent')}</strong>
                        <div>
                            <span class="badge-status badge-active" style="margin-right: 0.3rem;">Score: {o.get('score', 0)}/10</span>
                            <span class="badge-status">Conf: {o.get('confidence', 0)}/5</span>
                        </div>
                    </div>
                    <p style="font-size: 0.88rem; line-height: 1.5; color: #d1d5db; margin-bottom: 0.75rem;">{o.get('opinion', '')}</p>
                    {f'<div style="background: rgba(239, 68, 68, 0.05); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.15); margin-bottom: 0.75rem; font-size: 0.8rem; color: #f87171;"><strong>Gaps:</strong> {o.get("gaps", "")}</div>' if o.get("gaps") else ''}
                    <div style="font-size: 0.75rem; font-weight: bold; color: #9ca3af;">Verbatim Evidence:</div>
                    {"".join([f'<div style="font-size: 0.8rem; background: rgba(255,255,255,0.02); padding: 0.3rem 0.5rem; border-radius: 4px; margin-top: 0.25rem; border: 1px solid rgba(255,255,255,0.04);">"{ev.get("quote", "")}" ({ev.get("source", "")})</div>' for ev in o.get("evidence", [])])}
                </div>
                """, unsafe_allow_html=True)

    # TAB: Panel Debate
    with tab_debate:
        st.markdown("#### Panel Debate Log")
        st.write("Visual log of how agents reacted to and questioned other agents' logic, resulting in score updates.")
        
        for turn in debate.get("debate_interactions", []):
            o_score = turn.get("original_position", {}).get("score", 0)
            n_score = turn.get("new_position", {}).get("score", 0)
            is_shift = o_score != n_score
            
            glow_class = "debate-shift-glow" if is_shift else ""
            
            shift_row_html = ""
            if is_shift:
                shift_row_html = f"""
                <div class="score-shift-row">
                    <span class="badge-status" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">Score Shifted</span>
                    <span class="score-badge score-before">{o_score}/10</span>
                    <span style="color: #9ca3af;">➔</span>
                    <span class="score-badge score-after">{n_score}/10</span>
                </div>
                """
            else:
                shift_row_html = f"""
                <div class="score-shift-row">
                    <span class="score-badge score-before" style="background: rgba(255, 255, 255, 0.04);">Maintained Score: {n_score}/10</span>
                </div>
                """
                
            st.markdown(f"""
            <div class="debate-turn-container">
                <div class="debate-turn-node"></div>
                <div class="debate-card {glow_class}">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #a5b4fc; margin-bottom: 0.5rem;">
                        <strong>{turn.get('agent', '')}</strong>
                        <span>Reacting to: <strong>{turn.get('reacting_to', '')}</strong></span>
                    </div>
                    <p style="font-size: 0.88rem; line-height: 1.5; color: #d1d5db; margin-bottom: 0.5rem;">{turn.get('new_position', {}).get('opinion', '')}</p>
                    {shift_row_html}
                    <div style="font-size: 0.8rem; color: #9ca3af; margin-top: 0.3rem;">
                        <strong>Reason:</strong> {turn.get('reason_for_change_or_holding', '')}
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)

    # TAB: Final Verdict Log
    with tab_decision:
        st.markdown("#### Judge Decision Verdict Log")
        
        st.markdown("##### Judge Rationale:")
        st.info(decision.get("rationale", ""))
        
        st.markdown("##### Final Assigned Agent Weights:")
        for w in decision.get("agent_weights", []):
            st.markdown(f"""
            <div style="background: rgba(0,0,0,0.15); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <strong>{w.get('agent', '')}</strong>
                    <span style="color: {'#34d399' if w.get('weight') == 'High' else '#9ca3af'}">Weight: {w.get('weight', '')}</span>
                </div>
                <span style="font-size: 0.85rem; color: #9ca3af;">{w.get('reason', '')}</span>
            </div>
            """, unsafe_allow_html=True)
