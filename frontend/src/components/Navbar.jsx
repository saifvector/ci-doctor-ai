import { useState, useRef, useEffect } from "react"
import {
  GitBranch,
  ChevronDown,
  Search,
  Activity,
  LogOut,
  Plus,
} from "lucide-react"

function GithubIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function Navbar({
  user,
  activeRepo,
  repos = [],
  onSelectRepo,
  onLogin,
  onLogout,
  healthScore,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [customInput, setCustomInput] = useState("")
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredRepos = repos.filter((r) =>
    (r.fullName || r.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCustomSubmit = (e) => {
    e.preventDefault()
    if (!customInput.trim()) return
    const parts = customInput.trim().split("/")
    if (parts.length === 2 && parts[0] && parts[1]) {
      onSelectRepo({ owner: parts[0], repo: parts[1], fullName: customInput.trim() })
      setCustomInput("")
      setDropdownOpen(false)
    }
  }

  return (
    <header className="px-6 py-4 border-b border-gray-800 bg-[#0B1020]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Brand & Repo Selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                CD
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                CI Doctor AI
              </h1>
              <p className="text-[10px] text-gray-500 uppercase font-mono tracking-wider">
                Autonomous CI/CD Intelligence
              </p>
            </div>
          </div>

          <div className="hidden sm:block h-6 w-px bg-gray-800" />

          {/* Repository Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#131A2A] border border-gray-800 hover:border-gray-700 text-sm text-gray-200 transition-all cursor-pointer shadow-sm"
              title="Change active repository"
            >
              <GitBranch className="w-4 h-4 text-cyan-400" />
              <span className="font-mono text-xs text-gray-300 truncate max-w-[180px]">
                {activeRepo?.fullName || `${activeRepo?.owner}/${activeRepo?.repo}`}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute left-0 mt-2 w-80 bg-[#131A2A] border border-gray-800 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Search box */}
                <div className="relative mb-2.5">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search repositories..."
                    className="w-full bg-[#0B1020] border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                {/* Repo List */}
                <div className="max-h-52 overflow-y-auto space-y-1 mb-2.5 pr-1">
                  {filteredRepos.length > 0 ? (
                    filteredRepos.map((r) => {
                      const fullName = r.fullName || `${r.owner}/${r.name}`
                      const isSelected = activeRepo?.fullName === fullName
                      return (
                        <button
                          key={r.id || fullName}
                          onClick={() => {
                            onSelectRepo({
                              owner: r.owner,
                              repo: r.name,
                              fullName,
                            })
                            setDropdownOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "text-gray-300 hover:bg-gray-800/60"
                          }`}
                        >
                          <span className="truncate">{fullName}</span>
                          {isSelected && <span className="text-[10px] text-blue-400">ACTIVE</span>}
                        </button>
                      )
                    })
                  ) : (
                    <div className="text-center py-3 text-xs text-gray-500">
                      No matching repositories
                    </div>
                  )}
                </div>

                {/* Custom Repo Input */}
                <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-gray-800/80">
                  <p className="text-[10px] text-gray-500 mb-1.5 uppercase font-medium">
                    Inspect Custom Repository:
                  </p>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="owner/repo"
                      className="flex-1 bg-[#0B1020] border border-gray-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 font-mono"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Health Score & Auth Profile */}
        <div className="flex items-center gap-3">
          {/* CI Health Score Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <Activity className="w-3.5 h-3.5 text-green-400 animate-pulse" />
            <span className="text-xs text-green-300 font-mono font-semibold">
              CI Health: {healthScore || "94%"}
            </span>
          </div>

          {/* User Profile / GitHub Login */}
          {user?.authenticated ? (
            <div className="flex items-center gap-2.5 pl-2 border-l border-gray-800">
              <img
                src={user.user?.avatar_url || "https://github.com/identicons/app.png"}
                alt={user.user?.login || "User"}
                className="w-7 h-7 rounded-full border border-gray-700 object-cover"
              />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-white leading-tight">
                  {user.user?.name || user.user?.login}
                </p>
                <p className="text-[10px] text-gray-500 font-mono leading-tight">
                  @{user.user?.login} • {user.mode?.toUpperCase()}
                </p>
              </div>

              {user.mode === "oauth" && (
                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#131A2A] hover:bg-gray-800 border border-gray-700 rounded-xl text-xs font-medium text-white transition-colors cursor-pointer shadow-sm"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>Sign in with GitHub</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar