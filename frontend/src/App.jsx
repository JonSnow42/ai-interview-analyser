import React, { useState, useEffect } from 'react';
import { 
  FileText, Sparkles, MessageSquareCode, Award, User, 
  Briefcase, ChevronRight, Upload, Play,
  AlertTriangle, CheckCircle2, RefreshCw, Info, XCircle
} from 'lucide-react';
import './App.css';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [candidateId, setCandidateId] = useState('A');
  const [activeTab, setActiveTab] = useState('report');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  
  // Pipeline Data State
  const [allData, setAllData] = useState(null); // { A: {...}, B: {...} }
  
  // Evidence Popover Modal State
  const [popover, setPopover] = useState(null); // { title, quote, source, agent }

  // File states for upload
  const [files, setFiles] = useState({
    jobDescription: null,
    resumeA: null,
    resumeB: null,
    transcriptA: null,
    transcriptB: null
  });

  // Load backend configuration status (API key configured in env)
  const checkConfigStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/config`);
      const data = await res.json();
      setIsConfigured(data.configured);
    } catch (e) {
      console.error('Failed to connect to backend', e);
    }
  };

  useEffect(() => {
    checkConfigStatus();
    loadCachedData();
  }, []);

  // Try to load cached data on mount
  const loadCachedData = async () => {
    setLoading(true);
    setProgressMsg('Restoring last evaluation state...');
    try {
      const resA = await fetch(`${API_BASE}/candidate/full-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: 'A' })
      });
      const dataA = await resA.json();
      
      const resB = await fetch(`${API_BASE}/candidate/full-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: 'B' })
      });
      const dataB = await resB.json();
      
      if (dataA.success && dataB.success && dataA.profile && dataB.profile) {
        setAllData({
          A: dataA,
          B: dataB
        });
        setActiveTab('report');
      }
    } catch (error) {
      console.log('No pre-cached data found.');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  const handleFileChange = (field, file) => {
    setFiles(prev => ({ ...prev, [field]: file }));
  };

  // Submit File Upload and Run Pipeline via Stream Reader
  const handleUploadSubmit = async (e) => {
    if (e) e.preventDefault();

    // Job Description and Resumes are always required
    if (!files.jobDescription || !files.resumeA || !files.resumeB) {
      alert(`Job Description, Resume A, and Resume B are mandatory files.`);
      return;
    }

    setLoading(true);
    setProgressMsg('Uploading documents...');

    const formData = new FormData();
    Object.entries(files).forEach(([key, val]) => {
      if (val) formData.append(key, val);
    });

    try {
      const response = await fetch(`${API_BASE}/upload-pipeline`, {
        method: 'POST',
        body: formData
      });

      if (!response.body) {
        throw new Error('Streaming not supported by server response.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // save incomplete line to buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line);
              if (msg.status === 'Complete') {
                setAllData(msg.data);
                setActiveTab('report');
                setLoading(false);
                setProgressMsg('');
                return;
              } else if (msg.status.startsWith('Error:')) {
                throw new Error(msg.status);
              } else {
                setProgressMsg(msg.status);
              }
            } catch (err) {
              console.error('Failed to parse line:', line, err);
            }
          }
        }
      }
    } catch (err) {
      alert('Pipeline execution failed: ' + err.message);
      setLoading(false);
      setProgressMsg('');
    }
  };

  // Clear data and return to upload page
  const resetApp = async () => {
    if (!confirm('Are you sure you want to discard this report and upload new documents?')) return;
    setLoading(true);
    setProgressMsg('Clearing server cache...');
    try {
      await fetch(`${API_BASE}/candidate/reset-cache`, { method: 'POST' });
      setAllData(null);
      setFiles({
        jobDescription: null,
        resumeA: null,
        resumeB: null,
        transcriptA: null,
        transcriptB: null
      });
      setActiveTab('report');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  const openPopover = (title, quote, source, agent = '') => {
    if (!quote) return;
    setPopover({ title, quote, source, agent });
  };

  // Helper selectors for active candidate data
  const candidateData = allData ? allData[candidateId] : null;
  const profile = candidateData?.profile;
  const opinions = candidateData?.opinions;
  const debate = candidateData?.debate;
  const decision = candidateData?.decision;

  // Extract Strengths and Concerns based on Agent evidence
  const getStrengthsAndConcerns = () => {
    if (!opinions) return { strengths: [], concerns: [] };
    const strengths = [];
    const concerns = [];

    Object.keys(opinions).forEach(key => {
      const agent = opinions[key];
      if (key === 'skeptic') {
        agent.evidence.forEach(ev => {
          concerns.push({
            text: `Skeptic: ${ev.quote.substring(0, 70)}...`,
            quote: ev.quote,
            source: ev.source,
            agent: agent.agentName
          });
        });
      } else {
        if (agent.score >= 7) {
          agent.evidence.forEach(ev => {
            strengths.push({
              text: `${agent.agentName}: ${ev.quote.substring(0, 70)}...`,
              quote: ev.quote,
              source: ev.source,
              agent: agent.agentName
            });
          });
        } else if (agent.score > 0 && agent.score < 6) {
          agent.evidence.forEach(ev => {
            concerns.push({
              text: `${agent.agentName}: ${ev.quote.substring(0, 70)}...`,
              quote: ev.quote,
              source: ev.source,
              agent: agent.agentName
            });
          });
        }
      }
    });

    return { strengths, concerns };
  };

  const getUnresolvedDisagreements = () => {
    if (!debate) return [];
    const disagreements = [];
    debate.debate_interactions.forEach(turn => {
      if (turn.original_position.score === turn.new_position.score && turn.reacting_to) {
        disagreements.push({
          agent: turn.agent,
          reacting_to: turn.reacting_to,
          reason: turn.reason_for_change_or_holding,
          score: turn.new_position.score
        });
      }
    });
    return disagreements;
  };

  const { strengths, concerns } = getStrengthsAndConcerns();
  const unresolvedDisagreements = getUnresolvedDisagreements();

  return (
    <div className="app-container">
      <div className="bg-glow"></div>
      <div className="bg-glow-left"></div>

      {/* Header */}
      <header className="app-header">
        <div className="header-title-area">
          <h1>AI Interview Panel Simulator</h1>
          <p>Multi-agent evaluation, debate, and consensus decision pipeline</p>
        </div>
        <div className="header-controls">
          <div className={`badge-status ${isConfigured ? 'active' : 'inactive'}`}>
            {isConfigured ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {isConfigured ? 'Gemini Live Enabled' : 'Gemini Config Error / Missing Key'}
          </div>
          {allData && (
            <button className="btn btn-danger" onClick={resetApp}>
              <RefreshCw size={14} /> Reset & Upload New
            </button>
          )}
        </div>
      </header>

      {/* LOADING OVERLAY */}
      {loading && (
        <div className="card loading-overlay" style={{ minHeight: '300px' }}>
          <div className="spinner"></div>
          <h2 style={{ fontSize: '1.25rem', marginTop: '1rem', color: 'var(--text-primary)' }}>Executing Pipeline...</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{progressMsg}</p>
        </div>
      )}

      {/* STAGE 0: UPLOAD PANEL (Rendered when no results are loaded) */}
      {!loading && !allData && (
        <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card-title">
            <Upload size={20} />
            Upload Interview Materials
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Please select the Job Description and candidate resumes. The interview transcripts are optional. All files must be in PDF format.
          </p>

          <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              <div style={{ gridColumn: 'span 2' }}>
                <label htmlFor="jobDescription" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  1. Job Description *
                </label>
                <input 
                  id="jobDescription"
                  type="file" 
                  accept=".pdf" 
                  className="config-input" 
                  style={{ width: '100%', padding: '0.5rem' }}
                  onChange={(e) => handleFileChange('jobDescription', e.target.files[0])}
                  required
                />
              </div>

              <div>
                <label htmlFor="resumeA" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  2. Resume A (Rohan Malhotra) *
                </label>
                <input 
                  id="resumeA"
                  type="file" 
                  accept=".pdf" 
                  className="config-input" 
                  style={{ width: '100%', padding: '0.5rem' }}
                  onChange={(e) => handleFileChange('resumeA', e.target.files[0])}
                  required
                />
              </div>

              <div>
                <label htmlFor="resumeB" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  3. Resume B (Ananya Iyer) *
                </label>
                <input 
                  id="resumeB"
                  type="file" 
                  accept=".pdf" 
                  className="config-input" 
                  style={{ width: '100%', padding: '0.5rem' }}
                  onChange={(e) => handleFileChange('resumeB', e.target.files[0])}
                  required
                />
              </div>

              <div>
                <label htmlFor="transcriptA" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  4. Interview Transcript A (optional)
                </label>
                <input 
                  id="transcriptA"
                  type="file" 
                  accept=".pdf" 
                  className="config-input" 
                  style={{ width: '100%', padding: '0.5rem' }}
                  onChange={(e) => handleFileChange('transcriptA', e.target.files[0])}
                />
                {!files.transcriptA && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--warning)', marginTop: '0.25rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <Info size={12} /> No transcript provided — evaluation will be based on resume only
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="transcriptB" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  5. Interview Transcript B (optional)
                </label>
                <input 
                  id="transcriptB"
                  type="file" 
                  accept=".pdf" 
                  className="config-input" 
                  style={{ width: '100%', padding: '0.5rem' }}
                  onChange={(e) => handleFileChange('transcriptB', e.target.files[0])}
                />
                {!files.transcriptB && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--warning)', marginTop: '0.25rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <Info size={12} /> No transcript provided — evaluation will be based on resume only
                  </div>
                )}
              </div>

            </div>

            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }} aria-label="Run Evaluation Pipeline">
                <Play size={16} /> Run Evaluation Pipeline
              </button>
            </div>
          </form>

          {!isConfigured && (
            <div style={{ marginTop: '1.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong>Gemini API Key is not configured!</strong> Please add a valid <code>GEMINI_API_KEY</code> to your backend's <code>.env</code> file and restart the server to execute evaluations.
              </p>
            </div>
          )}
        </div>
      )}

      {/* DASHBOARD WORKSPACE (Rendered when data has been successfully loaded) */}
      {!loading && allData && (
        <>
          {/* Candidate Selector */}
          <div className="candidate-selector-bar">
            <div className="candidate-buttons">
              <button 
                className={`btn ${candidateId === 'A' ? 'btn-active' : ''}`}
                onClick={() => setCandidateId('A')}
              >
                <User size={16} /> Candidate A (Rohan Malhotra)
              </button>
              <button 
                className={`btn ${candidateId === 'B' ? 'btn-active' : ''}`}
                onClick={() => setCandidateId('B')}
              >
                <User size={16} /> Candidate B (Ananya Iyer)
              </button>
            </div>

            {profile && (
              <div className="candidate-summary-badge">
                {!profile.transcript_provided && (
                  <span className="badge-status inactive" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    Resume-only evaluation
                  </span>
                )}
                <span>
                  <Briefcase size={16} style={{ color: 'var(--primary)' }} />
                  Experience: <strong>{profile.years_of_experience} Years</strong>
                </span>
                {decision && (
                  <span>
                    <Award size={16} style={{ color: decision.recommendation === 'Hire' ? 'var(--success)' : decision.recommendation === 'No Hire' ? 'var(--danger)' : 'var(--warning)' }} />
                    Verdict: <strong style={{ color: decision.recommendation === 'Hire' ? '#34d399' : decision.recommendation === 'No Hire' ? '#f87171' : '#fbbf24' }}>{decision.recommendation}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="dashboard-grid">
            {/* Left Sidebar Tabs */}
            <aside className="pipeline-sidebar">
              <div className="pipeline-header">Evaluation Review</div>
              <div className="pipeline-steps">
                
                <div 
                  className={`pipeline-step-item ${activeTab === 'report' ? 'active' : ''}`}
                  onClick={() => setActiveTab('report')}
                >
                  <div className="step-label">
                    <Award size={16} />
                    Final Evaluation Report
                  </div>
                </div>

                <div 
                  className={`pipeline-step-item ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  <div className="step-label">
                    <FileText size={16} />
                    Stage 1: Candidate Profile
                  </div>
                </div>

                <div 
                  className={`pipeline-step-item ${activeTab === 'opinions' ? 'active' : ''}`}
                  onClick={() => setActiveTab('opinions')}
                >
                  <div className="step-label">
                    <Sparkles size={16} />
                    Stage 2: 4 Agent Opinions
                  </div>
                </div>

                <div 
                  className={`pipeline-step-item ${activeTab === 'debate' ? 'active' : ''}`}
                  onClick={() => setActiveTab('debate')}
                >
                  <div className="step-label">
                    <MessageSquareCode size={16} />
                    Stage 3: Cross-Agent Debate
                  </div>
                </div>

                <div 
                  className={`pipeline-step-item ${activeTab === 'decision' ? 'active' : ''}`}
                  onClick={() => setActiveTab('decision')}
                >
                  <div className="step-label">
                    <Award size={16} />
                    Stage 4: Judge Verdict Log
                  </div>
                </div>

              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                Mode: Live Gemini reasoning
              </div>
            </aside>

            {/* Right Main Content Panel */}
            <main className="content-area">
              
              {/* Tab 5: Final Consolidated Evaluation Report */}
              {activeTab === 'report' && profile && decision && (
                <div className="content-area" style={{ gap: '1.5rem' }}>
                  
                  {/* Verdict and Confidence Prominent Card at Top */}
                  <div className={`prominent-verdict-card ${decision.recommendation.toLowerCase().replace(' ', '-')}`}>
                    {/* Transcript Warning Banner inside Verdict Card */}
                    {!profile.transcript_provided && (
                      <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.75rem 1rem', borderRadius: '6px', color: '#fbbf24', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                        <AlertTriangle size={16} />
                        <span><strong>Resume-Only Evaluation:</strong> No interview transcript was provided. Rationale is based purely on resume claims. Confidence is reduced.</span>
                      </div>
                    )}

                    <div className="verdict-header-row">
                      <div>
                        <div className="verdict-main-label">Consensus Panel Recommendation</div>
                        <div className="verdict-big-value">{decision.recommendation}</div>
                      </div>
                      <div className="confidence-box">
                        <div className="verdict-main-label">Panel Confidence</div>
                        <div className="confidence-stars">
                          {[...Array(5)].map((_, i) => (
                            <Award 
                              key={i} 
                              size={14} 
                              style={{ 
                                color: i < decision.confidence ? 'var(--warning)' : 'var(--text-muted)',
                                fill: i < decision.confidence ? 'var(--warning)' : 'none'
                              }} 
                            />
                          ))}
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginTop: '0.2rem', color: '#fbbf24' }}>
                          {decision.confidence} / 5
                        </div>
                      </div>
                    </div>

                    <h3 style={{ color: '#a5b4fc', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: '700' }}>
                      Consensus Rationale
                    </h3>
                    <p style={{ fontSize: '0.88rem', lineHeight: '1.55', color: 'var(--text-secondary)' }}>
                      {decision.rationale}
                    </p>
                  </div>

                  {/* Strengths and Concerns */}
                  <div className="points-split">
                    <div className="point-card strength">
                      <div className="point-title">
                        <CheckCircle2 size={18} /> Strengths
                      </div>
                      <ul className="point-list">
                        {strengths.length > 0 ? (
                          strengths.map((pt, idx) => (
                            <li 
                              key={idx} 
                              className="point-item"
                              onClick={() => openPopover('Verified Strength', pt.quote, pt.source, pt.agent)}
                            >
                              {pt.quote.substring(0, 100)}... 
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.25rem' }}>({pt.source})</span>
                              <div className="source-tooltip">
                                <div className="tooltip-source-header">Verification Quote</div>
                                "{pt.quote}"<br/><strong>Source:</strong> {pt.source}
                              </div>
                            </li>
                          ))
                        ) : (
                          <li style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No high-confidence strengths verified.
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="point-card concern">
                      <div className="point-title">
                        <XCircle size={18} style={{ color: 'var(--danger)' }} /> Concerns & Red Flags
                      </div>
                      <ul className="point-list">
                        {concerns.length > 0 ? (
                          concerns.map((pt, idx) => (
                            <li 
                              key={idx} 
                              className="point-item"
                              onClick={() => openPopover('Verified Concern', pt.quote, pt.source, pt.agent)}
                            >
                              {pt.quote.substring(0, 100)}...
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.25rem' }}>({pt.source})</span>
                              <div className="source-tooltip">
                                <div className="tooltip-source-header">Verification Quote</div>
                                "{pt.quote}"<br/><strong>Source:</strong> {pt.source}
                              </div>
                            </li>
                          ))
                        ) : (
                          <li style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No red flags found in provided documents.
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Unresolved Disagreements Flag */}
                  {unresolvedDisagreements.length > 0 && (
                    <div className="card disagreements-card">
                      <div className="card-title" style={{ color: 'var(--warning)', borderBottomColor: 'rgba(245, 158, 11, 0.15)' }}>
                        <AlertTriangle size={20} /> Unresolved Panel Disagreements
                      </div>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        The following items caused persistent debate and score splits. No consensus score shift occurred on these items:
                      </p>
                      <div>
                        {unresolvedDisagreements.map((dis, idx) => (
                          <div key={idx} className="disagreement-item">
                            <strong>{dis.agent}</strong> held position at score <strong>{dis.score}/10</strong> against <strong>{dis.reacting_to}</strong>.<br/>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Reason: {dis.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Decisive Evidence List */}
                  <div className="card">
                    <div className="card-title"><Award size={20} /> Decisive Evidence & Citations</div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                      These specific quotes and findings from the source documents directly drove the judge's final verdict:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {decision.decisive_evidence.length > 0 ? (
                        decision.decisive_evidence.map((ev, idx) => (
                          <div 
                            key={idx} 
                            className="evidence-card"
                            onClick={() => openPopover('Decisive Evidence Source', ev.quote, ev.source, ev.agent_origin)}
                          >
                            <div style={{ fontStyle: 'italic', fontSize: '0.92rem' }}>"{ev.quote}"</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                              <span>Presented by: <strong>{ev.agent_origin}</strong></span>
                              <span>Document Section: <strong>{ev.source}</strong></span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No explicit decisive quotes linked.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 1: Profile View */}
              {activeTab === 'profile' && profile && (
                <div className="card">
                  <div className="card-title">
                    <FileText size={20} />
                    Candidate Profile Builder
                  </div>
                  
                  <div className="profile-section">
                    <div>
                      <h3 style={{ marginBottom: '0.5rem', color: '#a5b4fc' }}>Professional Details</h3>
                      <p style={{ marginBottom: '1rem' }}>
                        Candidate Name: <strong>{profile.name}</strong><br />
                        Years of Experience: <strong>{profile.years_of_experience}</strong>
                      </p>
                      
                      <h3 style={{ marginBottom: '0.5rem', color: '#a5b4fc' }}>Skills & Context</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {profile.skills_claimed.map((s, idx) => (
                          <div key={idx} className="evidence-card" onClick={() => openPopover(s.skill, `Experience claimed: ${s.years_of_experience} years. Context: ${s.context}`, 'Resume Profile')}>
                            <strong>{s.skill}</strong> {s.years_of_experience > 0 && `(${s.years_of_experience} yrs)`}
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{s.context}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 style={{ marginBottom: '0.5rem', color: '#a5b4fc' }}>Resume & Interview Claims</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        {profile.specific_claims.map((claim, idx) => (
                          <div key={idx} className="claim-item" onClick={() => openPopover('Claim Verification', claim.evidence, 'Source Documents')}>
                            <div>{claim.claim}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Click to view supporting quote</div>
                          </div>
                        ))}
                      </div>

                      <h3 style={{ marginBottom: '0.5rem', color: '#a5b4fc' }}>Key Interview Quotes</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {profile.notable_quotes.length > 0 ? (
                          profile.notable_quotes.map((q, idx) => (
                            <div key={idx} className="quote-item" onClick={() => openPopover('Transcript Quote', q.quote, q.context)}>
                              <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{q.quote}"</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Context: {q.context}</div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                            No interview transcript quotes available (Resume-only mode).
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Isolated Agent Opinions */}
              {activeTab === 'opinions' && opinions && (
                <div className="card">
                  <div className="card-title">
                    <Sparkles size={20} />
                    Isolated Agent Appraisals
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Initial scores and appraisals generated in isolation prior to the panel debate.
                  </p>
                  
                  <div className="agents-grid">
                    {Object.keys(opinions).map(key => {
                      const agent = opinions[key];
                      return (
                        <div key={key} className="agent-card">
                          <div className="agent-card-header">
                            <span className="agent-name">{agent.agentName}</span>
                            <div className="agent-metrics">
                              <span className="agent-badge score">Score: {agent.score > 0 ? `${agent.score}/10` : 'No Score'}</span>
                              <span className="agent-badge">Conf: {agent.confidence}/5</span>
                            </div>
                          </div>
                          
                          <p className="agent-opinion">{agent.opinion}</p>
                          
                          {agent.gaps && (
                            <div className="agent-gaps">
                              <div className="gaps-header">Information Gaps</div>
                              {agent.gaps}
                            </div>
                          )}
                          
                          <div className="agent-evidence-list">
                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', marginTop: '0.5rem' }}>VERBATIM EVIDENCE</div>
                            {agent.evidence.length > 0 ? (
                              agent.evidence.map((ev, idx) => (
                                <div 
                                  key={idx} 
                                  className="evidence-tag" 
                                  onClick={() => openPopover(agent.agentName + ' Evidence', ev.quote, ev.source)}
                                >
                                  "{ev.quote}" ({ev.source})
                                </div>
                              ))
                            ) : (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No quote citations provided.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: Panel Debate */}
              {activeTab === 'debate' && debate && (
                <div className="card">
                  <div className="card-title">
                    <MessageSquareCode size={20} />
                    Panel Debate Log
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Visual log of how agents reacted to and questioned other agents' logic, resulting in score updates.
                  </p>
                  
                  <div className="debate-timeline">
                    {debate.debate_interactions.map((turn, idx) => {
                      const isShift = turn.original_position.score !== turn.new_position.score;
                      return (
                        <div key={idx} className={`debate-turn ${isShift ? 'position-shifted' : ''}`}>
                          <div className="debate-node"></div>
                          <div className="debate-card">
                            <div className="debate-turn-header">
                              <span className="debate-speaker">{turn.agent}</span>
                              <span className="debate-reaction-tag">Reacting to: <strong>{turn.reacting_to}</strong></span>
                            </div>
                            
                            <p className="debate-dialogue">{turn.new_position.opinion}</p>
                            
                            {isShift ? (
                              <div className="debate-position-shift">
                                <div className="score-transition-row">
                                  <div className="transition-badge">Score Shifted</div>
                                  <div className="score-tag-diff">
                                    <span className="before-score">{turn.original_position.score}/10</span>
                                    <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                                    <span className="after-score">{turn.new_position.score}/10</span>
                                  </div>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  <strong>Reason for change:</strong> {turn.reason_for_change_or_holding}
                                </div>
                              </div>
                            ) : (
                              <div className="debate-position-shift no-shift">
                                <div style={{ fontSize: '0.85rem' }}>
                                  Maintained score: <strong>{turn.new_position.score}/10</strong>. Reason: {turn.reason_for_change_or_holding}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 4: Final Judge Verdict Log */}
              {activeTab === 'decision' && decision && (
                <div className="card">
                  <div className="card-title">
                    <Award size={20} />
                    Judge Decision Verdict Log
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <strong>Judge Rationale:</strong>
                      <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {decision.rationale}
                      </p>
                    </div>

                    <h3 style={{ color: '#a5b4fc', fontSize: '1rem' }}>Final Assigned Agent Weights:</h3>
                    {decision.agent_weights.map((w, idx) => (
                      <div key={idx} style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <strong>{w.agent}</strong>
                          <span style={{ color: w.weight === 'High' ? 'var(--success)' : 'var(--text-muted)' }}>Weight: {w.weight}</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{w.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </main>
          </div>
        </>
      )}

      {/* Popover Verification Modal Dialog */}
      {popover && (
        <div className="popover-modal" onClick={() => setPopover(null)}>
          <div className="popover-content" onClick={(e) => e.stopPropagation()}>
            <div className="popover-header">
              <span className="popover-title">{popover.title}</span>
              <button className="popover-close" onClick={() => setPopover(null)}>×</button>
            </div>
            {popover.agent && (
              <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Flagged by: {popover.agent}
              </div>
            )}
            <div className="popover-quote-box">
              "{popover.quote}"
            </div>
            <div className="popover-source-tag">
              <Info size={14} />
              <span>Source Verification Citation: <strong>{popover.source}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
