import {
  Wrench,
  CheckCircle2,
  GitCommit,
  Sparkles,
  Loader2,
  GitPullRequest,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Layers,
} from "lucide-react"

function FixPanel({
  data,
  loading,
  onGenerateFix,
  hasDiagnosis,
  onApplyFix,
  applyingPR = false,
  hasPR = false,
}) {
  if (loading) {
    return (
      <div className="bg-[#131A2A] border border-green-500/10 rounded-2xl p-6 shadow-xl shadow-green-500/5">
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
          <div className="text-center">
            <p className="text-green-400 font-semibold">Generating &amp; Verifying Fix...</p>
            <p className="text-gray-500 text-sm mt-1">
              Synthesizing patch and executing multi-stack verification checks
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-[#131A2A] border border-green-500/10 rounded-2xl p-6 shadow-xl shadow-green-500/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <Wrench className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-wide">
              AI Generated Fix
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Synthesize recovery patch &amp; execute verification engine
            </p>
          </div>
        </div>

        <button
          onClick={onGenerateFix}
          disabled={!hasDiagnosis}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer ${
            hasDiagnosis
              ? "bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 hover:shadow-lg hover:shadow-green-500/10"
              : "bg-gray-800/50 border border-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          {hasDiagnosis ? "Synthesize AI Fix" : "Run diagnosis first..."}
        </button>
      </div>
    )
  }

  const verification = data.verification || data.validation
  const isVerificationPassed = verification ? verification.validationPassed !== false : true
  const hasErrors = verification?.validationErrors && verification.validationErrors.length > 0
  const hasWarnings = verification?.validationWarnings && verification.validationWarnings.length > 0
  const confidenceScore = verification?.confidenceScore ?? parseInt(data.confidence) ?? 92

  return (
    <div className="bg-[#131A2A] border border-green-500/10 rounded-2xl p-6 shadow-xl shadow-green-500/5 backdrop-blur-sm">
      {/* HEADER */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <Wrench className="w-5 h-5 text-green-400" />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white tracking-wide">
              AI Generated Fix
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Recovery patch generated &amp; verified
            </p>
          </div>
        </div>

        {/* VERIFICATION STATUS BADGE */}
        <div className="flex items-center gap-2">
          {!isVerificationPassed ? (
            <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 px-3 py-1 rounded-full">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-300 font-mono font-semibold">VALIDATION FAILED</span>
            </div>
          ) : hasWarnings ? (
            <div className="flex items-center gap-1.5 bg-yellow-500/15 border border-yellow-500/30 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs text-yellow-300 font-mono font-semibold">VERIFIED WITH WARNINGS</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-300 font-mono font-semibold">PRE-MERGE VERIFIED</span>
            </div>
          )}
        </div>
      </div>

      {/* AI SUMMARY */}
      <div className="bg-black/20 border border-gray-800 rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-green-400" />
          <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider font-mono">
            Remediation Summary
          </h3>
        </div>
        <p className="text-sm text-gray-300 leading-7">{data.summary}</p>
        {data.reasoning && (
          <p className="text-xs text-gray-500 mt-2.5 pt-2.5 border-t border-gray-800/80 leading-5">
            <strong className="text-gray-400">Reasoning:</strong> {data.reasoning}
          </p>
        )}
      </div>

      {/* CONFIDENCE & CATEGORY & STACK */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3.5">
          <p className="text-[10px] text-green-300 uppercase tracking-wider mb-1 font-mono">
            Verification Confidence
          </p>
          <h3 className="text-2xl font-bold text-green-400 font-mono">{confidenceScore}%</h3>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3.5">
          <p className="text-[10px] text-blue-300 uppercase tracking-wider mb-1 font-mono">
            Patch Category
          </p>
          <h3 className="text-xs font-bold text-blue-400 uppercase font-mono truncate">
            {data.categoryType || "CONFIG"}
          </h3>
        </div>

        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-3.5">
          <p className="text-[10px] text-cyan-300 uppercase tracking-wider mb-1 font-mono flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>Target Stack</span>
          </p>
          <h3 className="text-xs font-bold text-cyan-300 uppercase font-mono truncate" title={verification?.projectType || "Node.js"}>
            {verification?.projectType || "Node.js"}
          </h3>
        </div>
      </div>

      {/* FIX VERIFICATION ENGINE BREAKDOWN */}
      {verification && (
        <div className="bg-black/25 border border-cyan-500/20 rounded-2xl p-5 mb-5 shadow-inner">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider font-mono">
                Verification Engine Results ({verification.checks?.length || 0} checks)
              </h3>
            </div>
            <span className="text-[10px] text-cyan-300 font-mono bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/20">
              {verification.summary ? "AUTOMATED GATEWAY" : "VERIFIED"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
            {(verification.checks || []).map((check, idx) => (
              <div
                key={idx}
                className="bg-[#0B1020] border border-gray-800 rounded-xl px-3 py-2 flex items-start gap-2.5"
              >
                {check.status === "failed" ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-200 truncate">{check.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* BLOCKING ERRORS LIST */}
          {hasErrors && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold mb-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Blocking Verification Errors ({verification.validationErrors.length})</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-red-300 space-y-0.5 pl-1">
                {verification.validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* WARNINGS LIST */}
          {hasWarnings && !hasErrors && (
            <div className="mt-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-1.5 text-yellow-400 text-xs font-semibold mb-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Verification Advisory Notes ({verification.validationWarnings.length})</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-yellow-300 space-y-0.5 pl-1">
                {verification.validationWarnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* FILES CHANGED */}
      {data.filesChanged && data.filesChanged.length > 0 && (
        <div className="bg-black/20 border border-gray-800 rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <GitCommit className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider font-mono">
              Files Modified ({data.filesChanged.length})
            </h3>
          </div>

          <div className="space-y-2">
            {data.filesChanged.map((file, index) => (
              <div
                key={index}
                className="bg-[#0B1020] border border-gray-800 rounded-xl px-4 py-2.5 font-mono text-xs text-gray-300 flex items-center justify-between"
              >
                <span>{file}</span>
                <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded">MODIFIED</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CODE DIFF */}
      {data.diff && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-mono">
              Generated Unified Diff
            </h3>
            <span className="text-xs text-green-400 font-mono">Unified Patch</span>
          </div>

          <div className="bg-black/40 border border-green-500/20 rounded-2xl p-4 overflow-x-auto shadow-inner max-h-72 overflow-y-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap leading-6">
              {data.diff.split("\n").map((line, i) => (
                <span
                  key={i}
                  className={
                    line.startsWith("+")
                      ? "text-green-400"
                      : line.startsWith("-")
                        ? "text-red-400"
                        : line.startsWith("@@")
                          ? "text-cyan-400"
                          : "text-gray-400"
                  }
                >
                  {line}
                  {"\n"}
                </span>
              ))}
            </pre>
          </div>
        </div>
      )}

      {/* PULL REQUEST CREATION ACTION WITH SAFETY GATING */}
      <div className="pt-2">
        {!isVerificationPassed ? (
          <div className="space-y-2">
            <button
              disabled
              className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-red-500/20 border border-red-500/40 text-red-300 flex items-center justify-center gap-2 cursor-not-allowed shadow-lg"
            >
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>PR Creation Blocked: Fix Failed Verification</span>
            </button>
            <p className="text-[11px] text-center text-red-400/80">
              Safety Gate Active: Fix must pass all pre-merge integrity checks before pull requests can be opened.
            </p>
          </div>
        ) : (
          <button
            onClick={onApplyFix}
            disabled={applyingPR || hasPR}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
              hasPR
                ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 cursor-default"
                : applyingPR
                  ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 cursor-wait"
                  : "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-200 hover:shadow-cyan-500/10"
            }`}
          >
            {applyingPR ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Applying Patch &amp; Creating PR...</span>
              </>
            ) : hasPR ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>Pull Request Created (See Details Below)</span>
              </>
            ) : (
              <>
                <GitPullRequest className="w-4 h-4 text-cyan-400" />
                <span>Apply Fix &amp; Open Pull Request</span>
                <ArrowRight className="w-4 h-4 text-cyan-400" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default FixPanel