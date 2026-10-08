import { useState, useEffect, useCallback, useRef } from "react"
import { AlertCircle } from "lucide-react"
import Navbar from "./components/Navbar"
import StatusCards from "./components/StatusCards"
import FailurePanel from "./components/FailurePanel"
import DiagnosisCard from "./components/DiagnosisCard"
import FixPanel from "./components/FixPanel"
import PRPanel from "./components/PRPanel"
import PipelineList from "./components/PipelineList"

const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3001/api"
    : "https://ci-doctor-ai.onrender.com/api"

function App() {
  const [user, setUser] = useState(null)
  const [repos, setRepos] = useState([])
  const [activeRepo, setActiveRepo] = useState(() => {
    try {
      const saved = localStorage.getItem("ci_doctor_repo")
      if (saved) return JSON.parse(saved)
    } catch {
      // ignore
    }
    return {
      owner: "techenthusiasticindia",
      repo: "ci-doctor-ai",
      fullName: "techenthusiasticindia/ci-doctor-ai",
    }
  })

  const [dashboard, setDashboard] = useState(null)
  const [pipelines, setPipelines] = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [failureData, setFailureData] = useState(null)
  const [diagnosis, setDiagnosis] = useState(null)
  const [fix, setFix] = useState(null)
  const [prResult, setPrResult] = useState(null)

  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [loading, setLoading] = useState({
    dashboard: true,
    pipelines: true,
    failure: false,
    diagnosis: false,
    fix: false,
    applyPR: false,
  })
  const [error, setError] = useState(null)

  const activeRepoRef = useRef(activeRepo)
  useEffect(() => {
    activeRepoRef.current = activeRepo
  }, [activeRepo])

  function getAuthHeader() {
    const session = localStorage.getItem("ci_doctor_session")
    return session ? { Authorization: `Bearer ${session}` } : {}
  }

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeader(),
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      }
    } catch (err) {
      console.warn("Auth check failed:", err.message)
    }
  }, [])

  const fetchRepositories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/repos`, {
        headers: getAuthHeader(),
      })
      if (res.ok) {
        const data = await res.json()
        setRepos(data.repos || [])
      }
    } catch (err) {
      console.warn("Repos fetch failed:", err.message)
    }
  }, [])

  const fetchDashboard = useCallback(async (repoObj = activeRepoRef.current, quiet = false) => {
    try {
      if (!quiet) setLoading((prev) => ({ ...prev, dashboard: true }))
      const query = `?owner=${encodeURIComponent(repoObj.owner)}&repo=${encodeURIComponent(repoObj.repo)}`
      const res = await fetch(`${API_BASE}/dashboard${query}`, {
        headers: getAuthHeader(),
      })
      const data = await res.json()
      setDashboard(data)
    } catch (err) {
      console.error("Dashboard fetch failed:", err)
      if (!quiet) setError("Failed to connect to backend. Is it running on port 3001?")
    } finally {
      if (!quiet) setLoading((prev) => ({ ...prev, dashboard: false }))
    }
  }, [])

  const selectPipeline = useCallback(async (runId, repoObj = activeRepoRef.current) => {
    setSelectedRun(runId)
    setDiagnosis(null)
    setFix(null)
    setPrResult(null)

    try {
      setLoading((prev) => ({ ...prev, failure: true }))
      const query = `?owner=${encodeURIComponent(repoObj.owner)}&repo=${encodeURIComponent(repoObj.repo)}`
      const res = await fetch(`${API_BASE}/pipelines/${runId}/failure${query}`, {
        headers: getAuthHeader(),
      })
      const data = await res.json()
      setFailureData(data)
    } catch (err) {
      console.error("Failure fetch failed:", err)
    } finally {
      setLoading((prev) => ({ ...prev, failure: false }))
    }
  }, [])

  const fetchPipelines = useCallback(async (repoObj = activeRepoRef.current, quiet = false) => {
    try {
      if (!quiet) setLoading((prev) => ({ ...prev, pipelines: true }))
      const query = `?owner=${encodeURIComponent(repoObj.owner)}&repo=${encodeURIComponent(repoObj.repo)}`
      const res = await fetch(`${API_BASE}/pipelines${query}`, {
        headers: getAuthHeader(),
      })
      const data = await res.json()
      const runs = data.runs || []
      setPipelines(runs)

      // Auto-select first failed pipeline if none currently selected
      if (!selectedRun) {
        const firstFailed = runs.find((r) => r.conclusion === "failure")
        if (firstFailed) {
          selectPipeline(firstFailed.id, repoObj)
        }
      }
    } catch (err) {
      console.error("Pipelines fetch failed:", err)
    } finally {
      if (!quiet) setLoading((prev) => ({ ...prev, pipelines: false }))
    }
  }, [selectedRun, selectPipeline])

  // Auth setup on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionParam = params.get("session")
    if (sessionParam) {
      localStorage.setItem("ci_doctor_session", sessionParam)
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    fetchCurrentUser()
    fetchRepositories()
  }, [fetchCurrentUser, fetchRepositories])

  // Refetch data when active repository changes
  useEffect(() => {
    if (activeRepo) {
      fetchDashboard(activeRepo)
      fetchPipelines(activeRepo)
    }
  }, [activeRepo, fetchDashboard, fetchPipelines])

  // Automated monitoring poll every 30s
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchDashboard(activeRepoRef.current, true)
      fetchPipelines(activeRepoRef.current, true)
    }, 30000)

    return () => clearInterval(interval)
  }, [autoRefresh, fetchDashboard, fetchPipelines])

  async function handleManualRefresh() {
    setRefreshing(true)
    try {
      await Promise.all([
        fetchDashboard(activeRepo, true),
        fetchPipelines(activeRepo, true),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  function handleLogin() {
    window.location.href = `${API_BASE}/auth/login`
  }

  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: getAuthHeader(),
      })
    } catch {
      // ignore
    }
    localStorage.removeItem("ci_doctor_session")
    fetchCurrentUser()
  }

  function handleSelectRepo(repoObj) {
    setSelectedRun(null)
    setFailureData(null)
    setDiagnosis(null)
    setFix(null)
    setPrResult(null)
    setActiveRepo(repoObj)
    try {
      localStorage.setItem("ci_doctor_repo", JSON.stringify(repoObj))
    } catch {
      // ignore
    }
  }

  async function runDiagnosis() {
    if (!selectedRun) return
    try {
      setLoading((prev) => ({ ...prev, diagnosis: true }))
      const res = await fetch(`${API_BASE}/pipelines/${selectedRun}/diagnose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          owner: activeRepo.owner,
          repo: activeRepo.repo,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error("Diagnosis API error:", data.error)
        setError(data.error || "Diagnosis failed")
        return
      }
      setDiagnosis(data.diagnosis)
      setError(null)
      fetchDashboard(activeRepo, true)
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
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          owner: activeRepo.owner,
          repo: activeRepo.repo,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error("Fix API error:", data.error)
        setError(data.error || "Fix generation failed")
        return
      }
      setFix(data.fix)
      setError(null)
      fetchDashboard(activeRepo, true)
    } catch (err) {
      console.error("Fix generation failed:", err)
      setError("Failed to generate AI fix. Check backend logs.")
    } finally {
      setLoading((prev) => ({ ...prev, fix: false }))
    }
  }

  async function runApplyFix() {
    if (!selectedRun || !fix) return
    try {
      setLoading((prev) => ({ ...prev, applyPR: true }))
      const res = await fetch(`${API_BASE}/fixes/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          runId: selectedRun,
          owner: activeRepo.owner,
          repo: activeRepo.repo,
          fix,
          baseBranch: "main",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error("PR Apply error:", data.error)
        setError(data.error || "Failed to create Pull Request")
        return
      }
      setPrResult(data)
      setError(null)
      fetchDashboard(activeRepo, true)
    } catch (err) {
      console.error("Apply fix failed:", err)
      setError("Failed to create Pull Request: " + err.message)
    } finally {
      setLoading((prev) => ({ ...prev, applyPR: false }))
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1020] text-white">
      <Navbar
        user={user}
        activeRepo={activeRepo}
        repos={repos}
        onSelectRepo={handleSelectRepo}
        onLogin={handleLogin}
        onLogout={handleLogout}
        healthScore={dashboard?.successRate}
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Error Banner without emojis */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
            <button
              onClick={() => {
                setError(null)
                fetchDashboard(activeRepo)
                fetchPipelines(activeRepo)
              }}
              className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Status Cards */}
        <StatusCards data={dashboard} loading={loading.dashboard} />

        {/* Pipeline List with Auto-Refresh and Manual Refresh */}
        <PipelineList
          pipelines={pipelines}
          loading={loading.pipelines}
          selectedRun={selectedRun}
          onSelectPipeline={(id) => selectPipeline(id, activeRepo)}
          onRefresh={handleManualRefresh}
          refreshing={refreshing}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
        />

        {/* Main Content - Failure + Diagnosis + Fix + PR */}
        {selectedRun && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="space-y-6">
              <FailurePanel data={failureData} loading={loading.failure} />
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
                onApplyFix={runApplyFix}
                applyingPR={loading.applyPR}
                hasPR={!!prResult}
              />

              {prResult && <PRPanel data={prResult} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App