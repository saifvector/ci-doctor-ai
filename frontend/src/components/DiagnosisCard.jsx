import { Bot, FileWarning, Sparkles, Loader2, Code2, FileCode, Layers, History, GitMerge, CheckCircle2, ShieldCheck, Fingerprint } from "lucide-react"

function DiagnosisCard({ data, loading, onDiagnose, hasFailureData }) {
  if (loading) {
    return (
      <div className="bg-[#131A2A] border border-blue-500/10 rounded-2xl p-6 shadow-xl shadow-blue-500/5">
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <div className="text-center">
            <p className="text-blue-400 font-semibold">AI Analyzing Pipeline...</p>
            <p className="text-gray-500 text-sm mt-1">
              Correlating error logs with repository context
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-[#131A2A] border border-blue-500/10 rounded-2xl p-6 shadow-xl shadow-blue-500/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Bot className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-wide">
              AI Diagnosis
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Analyze failure root cause with AI
            </p>
          </div>
        </div>

        <button
          onClick={onDiagnose}
          disabled={!hasFailureData}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer ${
            hasFailureData
              ? "bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10"
              : "bg-gray-800/50 border border-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          {hasFailureData ? "Run AI Diagnosis" : "Loading failure data..."}
        </button>
      </div>
    )
  }

  const getSeverityBadgeClass = (score) => {
    if (!score) return "bg-gray-500/10 text-gray-300 border-gray-500/20"
    if (score.includes("P0")) return "bg-red-500/15 text-red-400 border-red-500/30 font-bold"
    if (score.includes("P1")) return "bg-orange-500/15 text-orange-400 border-orange-500/30 font-bold"
    if (score.includes("P2")) return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
    return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
  }

  return (
    <div className="bg-[#131A2A] border border-blue-500/10 rounded-2xl p-6 shadow-xl shadow-blue-500/5 backdrop-blur-sm">
      {/* HEADER */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Bot className="w-5 h-5 text-blue-400" />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white tracking-wide">
              AI Diagnosis
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Root cause analysis &amp; failure triage
            </p>
          </div>
        </div>

        {/* AI ACTIVE & SEVERITY */}
        <div className="flex items-center gap-2">
          {data.severityScore && (
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-mono ${getSeverityBadgeClass(data.severityScore)}`}>
              {data.severityScore}
            </span>
          )}
          <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
            <span className="text-[10px] text-purple-300 font-mono">ACTIVE</span>
          </div>
        </div>
      </div>

      {/* ROOT CAUSE */}
      <div className="bg-black/20 border border-gray-800 rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider font-mono">
            Root Cause Identification
          </h3>
        </div>
        <p className="text-sm text-gray-300 leading-7">{data.rootCause}</p>
      </div>

      {/* CONFIDENCE + RISK + CATEGORY + DETECTED STACK */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {/* CONFIDENCE */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3.5">
          <p className="text-[10px] text-green-300 uppercase tracking-wider mb-1 font-mono">
            Confidence
          </p>
          <h3 className="text-xl font-bold text-green-400 font-mono">
            {data.confidence}
          </h3>
        </div>

        {/* RISK */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3.5">
          <p className="text-[10px] text-yellow-300 uppercase tracking-wider mb-1 font-mono">
            Risk Level
          </p>
          <h3 className="text-xl font-bold text-yellow-400 font-mono">
            {data.riskLevel}
          </h3>
        </div>

        {/* CATEGORY */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3.5">
          <p className="text-[10px] text-blue-300 uppercase tracking-wider mb-1 font-mono">
            Category
          </p>
          <h3 className="text-xs font-bold text-blue-300 uppercase font-mono truncate">
            {data.category || "UNKNOWN"}
          </h3>
        </div>

        {/* DETECTED PROJECT STACK */}
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-3.5">
          <p className="text-[10px] text-cyan-300 uppercase tracking-wider mb-1 font-mono flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>Stack</span>
          </p>
          <h3 className="text-xs font-bold text-cyan-300 uppercase font-mono truncate" title={data.projectType || "Node.js"}>
            {data.projectType || "Node.js"}
          </h3>
        </div>
      </div>

      {/* DETERMINISTIC FAILURE FINGERPRINT */}
      {data.failureFingerprint && (
        <div className="flex items-center justify-between bg-black/30 border border-gray-800 rounded-xl px-3.5 py-2 mb-5 font-mono text-[11px] text-gray-400">
          <div className="flex items-center gap-1.5 truncate">
            <Fingerprint className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="text-gray-500">Fingerprint:</span>
            <span className="text-blue-300 font-medium truncate" title={data.failureFingerprint.exactHash}>
              {data.failureFingerprint.exactHash.substring(0, 16)}...
            </span>
          </div>
          {data.failureFingerprint.structuralHash && (
            <span className="text-gray-500 hidden sm:inline text-[10px]">
              STRUCTURAL: {data.failureFingerprint.structuralHash.substring(0, 8)}
            </span>
          )}
        </div>
      )}

      {/* AFFECTED FILES */}
      {data.affectedFiles && data.affectedFiles.length > 0 && (
        <div className="bg-black/20 border border-gray-800 rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <FileWarning className="w-4 h-4 text-red-400" />
            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider font-mono">
              Affected Files ({data.affectedFiles.length})
            </h3>
          </div>

          <div className="space-y-2">
            {data.affectedFiles.map((file, index) => (
              <div
                key={index}
                className="bg-[#0B1020] border border-gray-800 rounded-xl px-3.5 py-2 font-mono text-xs text-gray-300"
              >
                {file}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GROUNDED EVIDENCE / CODE CITATIONS */}
      {data.supportingEvidence && data.supportingEvidence.length > 0 && (
        <div className="bg-black/25 border border-cyan-500/20 rounded-2xl p-5 mb-5 shadow-inner">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider font-mono">
                Grounded Repository Evidence ({data.supportingEvidence.length})
              </h3>
            </div>
            <span className="text-[10px] text-cyan-300 font-mono bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              CODE-VERIFIED
            </span>
          </div>

          <div className="space-y-3">
            {data.supportingEvidence.map((ev, index) => (
              <div
                key={index}
                className="bg-[#0B1020] border border-gray-800 rounded-xl p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-white font-medium flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                    {ev.file}
                  </span>
                  {ev.lineRange && (
                    <span className="text-[10px] font-mono bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700">
                      {ev.lineRange}
                    </span>
                  )}
                </div>

                {ev.snippet && (
                  <pre className="text-xs font-mono bg-black/40 border border-gray-800/80 rounded-lg p-2.5 text-cyan-200/90 overflow-x-auto whitespace-pre-wrap leading-5">
                    {ev.snippet}
                  </pre>
                )}

                {ev.explanation && (
                  <p className="text-xs text-gray-400 leading-relaxed pt-1">
                    <strong className="text-gray-300">Grounding Rationale:</strong> {ev.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HISTORICAL FAILURE MEMORY & SIMILAR INCIDENTS */}
      {data.similarIncidents && data.similarIncidents.length > 0 && (
        <div className="bg-black/25 border border-purple-500/20 rounded-2xl p-5 mb-5 shadow-inner">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider font-mono">
                Failure Memory &amp; Similar Incidents ({data.similarIncidents.length})
              </h3>
            </div>
            {data.historicalMetrics?.successRate && (
              <span className="text-[10px] text-purple-300 font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Success Rate: {data.historicalMetrics.successRate}</span>
              </span>
            )}
          </div>

          <div className="space-y-3">
            {data.similarIncidents.map((inc, index) => {
              const score = typeof inc.similarityScore === 'number' ? inc.similarityScore : 0
              const scoreBadgeClass = score >= 0.85
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : score >= 0.60
                ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                : 'bg-purple-500/15 text-purple-300 border-purple-500/30'

              const isVerified = inc.verificationOutcome?.validationPassed === true
              const isMerged = inc.prOutcome?.merged === true

              return (
                <div
                  key={inc.id || index}
                  className="bg-[#0B1020] border border-gray-800 rounded-xl p-3.5 space-y-2 hover:border-purple-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${scoreBadgeClass}`}>
                        {inc.similarityPercentage || `${Math.round(score * 100)}%`} MATCH
                      </span>
                      <span className="text-xs font-mono text-gray-300 font-medium">
                        {inc.category?.toUpperCase() || 'FAILURE'} &bull; {inc.failedStep || inc.workflowName || 'CI Step'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isMerged && (
                        <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                          <GitMerge className="w-3 h-3 text-purple-400" />
                          <span>MERGED PR</span>
                        </span>
                      )}
                      {isVerified && (
                        <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>VERIFIED RESOLUTION</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    <span className="text-gray-500 font-mono text-[11px] block mb-0.5">HISTORICAL ROOT CAUSE:</span>
                    {inc.diagnosis?.rootCause || inc.logs?.substring(0, 150) || 'Previous failure'}
                  </p>

                  {inc.fixOutcome?.title && (
                    <div className="bg-black/40 border border-gray-800/80 rounded-lg p-2.5 text-xs text-gray-300 flex items-start gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-gray-400 font-mono text-[10px] uppercase block">Prior Successful Fix:</span>
                        <span className="text-emerald-300 font-medium">{inc.fixOutcome.title}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* RECOMMENDED HISTORICAL FIX */}
          {data.recommendedHistoricalFix && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-300 font-mono uppercase tracking-wider">
                      Recommended Historical Fix
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {data.recommendedHistoricalFix.similarityScore} CONFIDENCE
                  </span>
                </div>
                <p className="text-xs text-white font-medium mb-2">
                  {data.recommendedHistoricalFix.title}
                </p>
                {data.recommendedHistoricalFix.diff && (
                  <pre className="text-xs font-mono bg-black/60 border border-gray-800 rounded-lg p-2.5 text-emerald-200/90 overflow-x-auto whitespace-pre-wrap leading-5 max-h-36">
                    {data.recommendedHistoricalFix.diff}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RECOMMENDATION */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
        <p className="text-xs text-blue-300 uppercase tracking-wider mb-2 font-mono">
          Recommended Action
        </p>
        <p className="text-sm text-gray-300 leading-7">
          {data.recommendation}
        </p>
      </div>
    </div>
  )
}

export default DiagnosisCard