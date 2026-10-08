import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  GitBranch,
  RefreshCw,
  Layers,
} from "lucide-react"

function PipelineList({
  pipelines,
  loading,
  selectedRun,
  onSelectPipeline,
  onRefresh,
  refreshing = false,
  autoRefresh = true,
  onToggleAutoRefresh,
}) {
  if (loading && (!pipelines || pipelines.length === 0)) {
    return (
      <div className="mt-6 bg-[#131A2A] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="text-gray-400">Loading pipelines from GitHub...</span>
        </div>
      </div>
    )
  }

  if (!pipelines || pipelines.length === 0) {
    return (
      <div className="mt-6 bg-[#131A2A] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-sm">
            No pipeline runs found for this repository.
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  const getStatusIcon = (conclusion) => {
    switch (conclusion) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case "failure":
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />
    }
  }

  const getStatusBadge = (run) => {
    switch (run.conclusion) {
      case "success":
        return (
          <span className="text-[11px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-mono">
            PASSED
          </span>
        )
      case "failure":
        return (
          <div className="flex items-center gap-1.5">
            {run.failedJobsCount > 1 ? (
              <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                <Layers className="w-3 h-3 text-red-400" />
                <span>MATRIX ({run.failedJobsCount} FAILED)</span>
              </span>
            ) : (
              <span className="text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-mono">
                FAILED
              </span>
            )}
          </div>
        )
      default:
        return (
          <span className="text-[11px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full font-mono">
            {run.conclusion?.toUpperCase() || "RUNNING"}
          </span>
        )
    }
  }

  const getRelativeTime = (dateStr) => {
    const now = new Date()
    const then = new Date(dateStr)
    const diffMs = now - then
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  return (
    <div className="mt-6">
      {/* SECTION HEADER & MONITORING CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Workflow Failure Monitoring
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {pipelines.length} workflow runs detected • Click any failed run to diagnose
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* AUTO-REFRESH TOGGLE */}
          {onToggleAutoRefresh && (
            <button
              onClick={onToggleAutoRefresh}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                autoRefresh
                  ? "bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20"
                  : "bg-gray-800/60 border-gray-700 text-gray-400 hover:bg-gray-800"
              }`}
              title="Toggle 30-second automated monitoring poll"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  autoRefresh ? "bg-green-400 animate-pulse" : "bg-gray-500"
                }`}
              />
              <span>Auto-Poll: {autoRefresh ? "30s" : "OFF"}</span>
            </button>
          )}

          {/* MANUAL REFRESH BUTTON */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 bg-[#131A2A] hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-400" : ""}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* PIPELINE GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {pipelines.slice(0, 12).map((run) => (
          <button
            key={run.id}
            onClick={() =>
              run.conclusion === "failure" && onSelectPipeline(run.id)
            }
            className={`text-left p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
              selectedRun === run.id
                ? "bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/5 ring-1 ring-red-500/30"
                : run.conclusion === "failure"
                  ? "bg-[#131A2A] border-red-500/15 hover:border-red-500/30 hover:bg-red-500/5"
                  : "bg-[#131A2A] border-gray-800/80 opacity-60 cursor-default"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {getStatusIcon(run.conclusion)}
                <span className="text-sm font-medium text-white truncate max-w-[150px]">
                  {run.name}
                </span>
              </div>
              {getStatusBadge(run)}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <GitBranch className="w-3 h-3 text-gray-500 shrink-0" />
              <span className="text-xs text-gray-400 font-mono truncate max-w-[120px]">
                {run.branch}
              </span>
              <span className="text-xs text-gray-600">•</span>
              <span className="text-xs text-gray-500">
                {getRelativeTime(run.timestamp)}
              </span>
            </div>

            <p className="text-xs text-gray-500 mt-1 truncate">
              {run.commit} • {run.commitMessage}
            </p>

            {run.conclusion === "failure" && run.hasDiagnosis && (
              <div className="mt-2.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                <span className="text-xs text-purple-300 font-mono">DIAGNOSED &amp; GROUNDED</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export default PipelineList
