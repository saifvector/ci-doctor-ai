import { Bot, FileWarning, Sparkles, Loader2 } from "lucide-react"

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

      {/* CONFIDENCE + RISK + CATEGORY */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {/* CONFIDENCE */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3.5">
          <p className="text-[10px] text-green-300 uppercase tracking-wider mb-1 font-mono">
            Confidence
          </p>
          <h3 className="text-2xl font-bold text-green-400 font-mono">
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
      </div>

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