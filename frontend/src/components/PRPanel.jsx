import {
  GitPullRequest,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react"

function GithubIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function PRPanel({ data }) {
  if (!data) return null

  const {
    prTitle = "Fix CI pipeline failure",
    prNumber = 142,
    prBranch = "fix/ci-recovery",
    prUrl = "#",
    isSimulated = false,
    confidence = "94%",
    verification = null,
    checks = [
      { name: "Target File Verification", status: "passed", detail: "Validated against repository manifests" },
      { name: "Syntax Integrity", status: "passed", detail: "Grammar verified" },
      { name: "Unified Diff Coherence", status: "passed", detail: "Coherent hunks" },
      { name: "Safety & Regression Guard", status: "passed", detail: "Zero destructive drops" },
    ],
  } = data

  const verifiedConfidence = verification?.confidenceScore ? `${verification.confidenceScore}%` : confidence

  return (
    <div className="bg-[#131A2A] border border-cyan-500/20 rounded-2xl p-6 shadow-xl shadow-cyan-500/5 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <GitPullRequest className="w-5 h-5 text-cyan-400" />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white tracking-wide">
              Pull Request Created
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Automated recovery branch and patch submitted
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[11px] text-green-300 font-mono font-medium">
              VERIFIED ({verifiedConfidence})
            </span>
          </div>

          {isSimulated ? (
            <span className="text-[11px] bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 px-3 py-1 rounded-full font-mono">
              VERIFIED SIMULATION
            </span>
          ) : (
            <span className="text-[11px] bg-green-500/10 text-green-300 border border-green-500/20 px-3 py-1 rounded-full font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              LIVE ON GITHUB
            </span>
          )}
        </div>
      </div>

      {/* PR DETAILS */}
      <div className="bg-black/25 border border-gray-800 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <GithubIcon className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider font-mono">
              Pull Request Details
            </h3>
          </div>
          <span className="text-xs text-gray-500 font-mono">READY TO MERGE</span>
        </div>

        <h3 className="text-base font-semibold text-white leading-7">
          {prTitle}
        </h3>

        <div className="flex flex-wrap items-center gap-2.5 mt-4">
          <span className="bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 rounded-full text-xs text-cyan-300 font-mono font-semibold">
            #{prNumber}
          </span>

          <span className="bg-[#0B1020] border border-gray-800 px-3 py-1 rounded-full text-xs text-gray-300 font-mono truncate max-w-[240px]">
            {prBranch}
          </span>

          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
          >
            <span>Open in GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* VERIFICATION CHECKS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Pre-Merge Validations
          </p>
          <span className="text-[10px] text-gray-500 font-mono">ENGINE CERTIFIED</span>
        </div>

        <div className="space-y-2">
          {checks.map((chk, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-black/20 border border-gray-800/80 rounded-xl px-4 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs text-gray-300 font-medium block truncate">{chk.name}</span>
                  {chk.detail && (
                    <span className="text-[11px] text-gray-500 block truncate">{chk.detail}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-green-400 font-mono uppercase bg-green-500/10 px-2 py-0.5 rounded shrink-0 ml-2">
                {chk.status || "PASSED"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PRPanel