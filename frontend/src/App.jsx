import { useState, useEffect } from "react"
import Navbar from "./components/Navbar"
import StatusCards from "./components/StatusCards"
import FailurePanel from "./components/FailurePanel"
import DiagnosisCard from "./components/DiagnosisCard"
import FixPanel from "./components/FixPanel"
import PipelineList from "./components/PipelineList"

const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:3001/api"
  : "https://ci-doctor-ai.onrender.com/api"

function App() {
  const [dashboard, setDashboard] = useState(null)
  const [pipelines, setPipelines] = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [failureData, setFailureData] = useState(null)
  const [diagnosis, setDiagnosis] = useState(null)
  const [fix, setFix] = useState(null)
  const [loading, setLoading] = useState({
    dashboard: true,
    pipelines: true,
    failure: false,
    diagnosis: false,
    fix: false,
  })
  const [error, setError] = useState(null)

  // Fetch dashboard stats on mount
  useEffect(() => {
    fetchDashboard()
    fetchPipelines()
  // eslint-disable-next-line
  }, [])

  async function fetchDashboard() {
    try {
      setLoading((prev) => ({ ...prev, dashboard: true }))
      const res = await fetch(`${API_BASE}/dashboard`)
      const data = await res.json()
      setDashboard(data)
    } catch (err) {
      console.error("Dashboard fetch failed:", err)
      setError("Failed to connect to backend. Is it running on port 3001?")
    } finally {
      setLoading((prev) => ({ ...prev, dashboard: false }))
    }
  }

  async function fetchPipelines() {
    try {
      setLoading((prev) => ({ ...prev, pipelines: true }))
      const res = await fetch(`${API_BASE}/pipelines`)
      const data = await res.json()
      setPipelines(data.runs || [])

      // Auto-select first failed pipeline
      const firstFailed = (data.runs || []).find(
        (r) => r.conclusion === "failure"
      )
      if (firstFailed) {
        selectPipeline(firstFailed.id)
      }
    } catch (err) {
      console.error("Pipelines fetch failed:", err)
    } finally {
      setLoading((prev) => ({ ...prev, pipelines: false }))
    }
  }

  async function selectPipeline(runId) {
    setSelectedRun(runId)
    setDiagnosis(null)
    setFix(null)

    try {
      setLoading((prev) => ({ ...prev, failure: true }))
      const res = await fetch(`${API_BASE}/pipelines/${runId}/failure`)
      const data = await res.json()
      setFailureData(data)
    } catch (err) {
      console.error("Failure fetch failed:", err)
    } finally {
      setLoading((prev) => ({ ...prev, failure: false }))
    }
  }

  async function runDiagnosis() {
    if (!selectedRun) return
    try {
      setLoading((prev) => ({ ...prev, diagnosis: true }))
      const res = await fetch(`${API_BASE}/pipelines/${selectedRun}/diagnose`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        console.error("Diagnosis API error:", data.error)
        setError(data.error || "Diagnosis failed")
        return
      }
      setDiagnosis(data.diagnosis)
      setError(null)
      // Refresh dashboard stats
      fetchDashboard()
    } catch (err) {
      console.error("Diagnosis failed:", err)
      setError("Failed to run AI diagnosis. Check backend logs.")
    } finally {
      setLoading((prev) => ({ ...prev, diagnosis: false }))
    }
  }

  async function runFix() {
    if (!selectedRun) return
    try {
      setLoading((prev) => ({ ...prev, fix: true }))
      const res = await fetch(`${API_BASE}/pipelines/${selectedRun}/fix`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        console.error("Fix API error:", data.error)
        setError(data.error || "Fix generation failed")
        return
      }
      setFix(data.fix)
      setError(null)
      // Refresh dashboard stats
      fetchDashboard()
    } catch (err) {
      console.error("Fix generation failed:", err)
      setError("Failed to generate AI fix. Check backend logs.")
    } finally {
      setLoading((prev) => ({ ...prev, fix: false }))
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1020] text-white">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-red-400 text-sm">⚠️ {error}</span>
            </div>
            <button
              onClick={() => {
                setError(null)
                fetchDashboard()
                fetchPipelines()
              }}
              className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Status Cards */}
        <StatusCards data={dashboard} loading={loading.dashboard} />

        {/* Pipeline List */}
        <PipelineList
          pipelines={pipelines}
          loading={loading.pipelines}
          selectedRun={selectedRun}
          onSelectPipeline={selectPipeline}
        />

        {/* Main Content - Failure + Diagnosis + Fix */}
        {selectedRun && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="space-y-6">
              <FailurePanel
                data={failureData}
                loading={loading.failure}
              />
              <DiagnosisCard
                data={diagnosis}
                loading={loading.diagnosis}
                onDiagnose={runDiagnosis}
                hasFailureData={!!failureData}
              />
            </div>

            <div className="space-y-6">
              <FixPanel
                data={fix}
                loading={loading.fix}
                onGenerateFix={runFix}
                hasDiagnosis={!!diagnosis}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App