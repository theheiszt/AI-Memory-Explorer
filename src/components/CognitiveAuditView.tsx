import React, { useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Brain,
  ShieldAlert,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
  Lightbulb,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { NormalizedMemoryRecord, AuditResult, AuditFinding } from '../types/memory.ts';

interface CognitiveAuditViewProps {
  records: NormalizedMemoryRecord[];
  sourceName: string;
  onSelectRecord: (record: NormalizedMemoryRecord) => void;
}

export const CognitiveAuditView: React.FC<CognitiveAuditViewProps> = ({
  records,
  sourceName,
  onSelectRecord,
}) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState('Contradictions, Temporal Drift, and Hallucination Risks');
  const [useArgon, setUseArgon] = useState(false);
  const [showThinkingTrace, setShowThinkingTrace] = useState(true);

  const runAudit = async () => {
    setIsAuditing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/gemini/audit-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memories: records,
          sourceName,
          focusArea,
          useArgon,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      setAuditResult(data);
    } catch (err: any) {
      console.error('Audit failed:', err);
      setErrorMessage(err.message || 'Failed to complete cognitive audit.');
    } finally {
      setIsAuditing(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'medium':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    }
  };

  return (
    <div className="flex-1 h-full w-full bg-slate-950 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
      {/* Header Banner */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/30 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Brain className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-100 font-sans">
                Cognitive Audit & Knowledge Health Check
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-900/50 text-purple-200 border border-purple-700/50">
                Thinking Level: High ({useArgon ? 'Gemini 4 Argon' : 'Gemini 3.8 Flash'})
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Audits the agent's stored memories for subtle logical contradictions, outdated or conflicting beliefs, ungrounded assertions, and semantic fragmentation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300" title="Requires paid API key tier with argon quota">
              <input
                type="checkbox"
                checked={useArgon}
                onChange={e => setUseArgon(e.target.checked)}
                className="rounded accent-purple-500"
              />
              <span>Use Gemini 4 Argon (Paid Key)</span>
            </label>

            <button
              onClick={runAudit}
              disabled={isAuditing}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
              <span>{isAuditing ? 'Auditing Memories...' : 'Run Cognitive Audit'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-start gap-3 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Audit Execution Notice:</span> {errorMessage}
            <p className="text-slate-400 mt-1">
              Verify your server environment is configured or run on cached preset findings.
            </p>
          </div>
        </div>
      )}

      {/* Results View */}
      {auditResult ? (
        <div className="space-y-5">
          {/* Executive Summary */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Architectural Summary</span>
            </h3>
            <p className="text-slate-200 text-sm leading-relaxed font-sans whitespace-pre-wrap">
              {auditResult.summary}
            </p>
          </div>

          {/* Thinking Trace (Deep Reasoning Accordion) */}
          {auditResult.thinkingProcess && (
            <div className="rounded-xl bg-slate-900/80 border border-purple-900/40 overflow-hidden">
              <button
                onClick={() => setShowThinkingTrace(!showThinkingTrace)}
                className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span>High Thinking Reasoning Process (Deep Agent Analysis)</span>
                </div>
                {showThinkingTrace ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showThinkingTrace && (
                <div className="p-4 border-t border-purple-900/30 bg-slate-950/70 text-slate-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                  {auditResult.thinkingProcess}
                </div>
              )}
            </div>
          )}

          {/* Findings List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Audit Findings & Remediation ({auditResult.findings?.length || 0})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {auditResult.findings?.map((finding: AuditFinding, idx: number) => (
                <div
                  key={finding.id || idx}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 space-y-2.5 transition-all shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityBadge(
                        finding.severity
                      )}`}
                    >
                      {finding.severity} • {finding.type}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-100 font-sans">
                    {finding.title}
                  </h4>

                  <p className="text-slate-300 text-xs leading-relaxed">
                    {finding.description}
                  </p>

                  {/* Involved Memory IDs */}
                  {finding.involvedMemoryIds && finding.involvedMemoryIds.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium">Involved Records:</span>
                      {finding.involvedMemoryIds.map(memId => {
                        const rec = records.find(r => r.id === memId);
                        return (
                          <button
                            key={memId}
                            onClick={() => rec && onSelectRecord(rec)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono text-[10px] border border-slate-700 flex items-center gap-1 transition-colors"
                            title={`Inspect ${memId}`}
                          >
                            <span>{memId}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Suggested Action */}
                  <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-900/40 text-[11px] text-indigo-200 flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-indigo-300">Action: </span>
                      {finding.suggestedAction}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 rounded-xl bg-slate-900/60 border border-slate-800 text-center max-w-lg mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-400 mx-auto flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">
            Cognitive Audit Ready
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Click <strong className="text-slate-200">"Run Cognitive Audit"</strong> above to launch deep semantic inspection using Gemini 4 Argon with High Thinking. It will analyze your currently loaded {records.length} memories for contradictory beliefs, temporal drift, and knowledge coherence.
          </p>
        </div>
      )}
    </div>
  );
};
