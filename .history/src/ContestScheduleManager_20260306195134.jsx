/**
 * Contest Schedule Manager Component
 * Manages creating, updating, deleting, and starting scheduled contests
 */

import { useState, useCallback, useEffect } from "react";

export function ContestScheduleManager({ open, authUser, onClose }) {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [formData, setFormData] = useState({
    scheduledDate: "",
    scheduledTime: "20:00",
    durationHours: 2,
    topics: [],
  });

  const allTopics = [
    "Dynamic Programming",
    "Graphs & Trees",
    "Greedy Algorithms",
    "Binary Search",
    "Number Theory",
    "Data Structures",
    "Sorting",
    "Hashing",
  ];

  const loadContests = useCallback(async () => {
    if (!authUser?.codeforces_id) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/contests/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeforcesId: authUser.codeforces_id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Failed to load contests");
      setContests(data.contests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authUser?.codeforces_id]);

  useEffect(() => {
    if (open) {
      loadContests();
    }
  }, [open, loadContests]);

  const handleCreateContest = async (e) => {
    e.preventDefault();
    if (!formData.scheduledDate || !formData.scheduledTime) {
      setError("Please select date and time");
      return;
    }
    if (formData.topics.length === 0) {
      setError("Please select at least one topic");
      return;
    }

    const dateTimeStr = `${formData.scheduledDate}T${formData.scheduledTime}:00`;
    const scheduledAt = Math.floor(new Date(dateTimeStr).getTime() / 1000);

    setLoading(true);
    try {
      const response = await fetch("/api/contests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codeforcesId: authUser.codeforces_id,
          scheduledAt,
          durationSeconds: formData.durationHours * 3600,
          topics: formData.topics,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Failed to create contest");
      
      setFormData({ scheduledDate: "", scheduledTime: "20:00", durationHours: 2, topics: [] });
      setShowCreateForm(false);
      await loadContests();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContest = async (contestId) => {
    if (!window.confirm("Are you sure you want to delete this contest?")) return;
    
    setLoading(true);
    try {
      const response = await fetch("/api/contests/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestId,
          codeforcesId: authUser.codeforces_id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Failed to delete contest");
      await loadContests();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartContest = async (contestId) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/contests/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestId,
          codeforcesId: authUser.codeforces_id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Failed to start contest");
      setError(""); // Clear error on success
      await loadContests();
      // Optionally navigate to contest page
      console.log("Contest started:", data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getTimeUntil = (scheduledAt) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = scheduledAt - now;
    if (diff < 0) return "Started";
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  if (!open) return null;

  const upcomingContests = contests.filter((c) => c.status === "pending");
  const runningContests = contests.filter((c) => c.status === "running");
  const completedContests = contests.filter((c) => c.status === "completed");

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center bg-slate-950/75 p-2 sm:p-4">
      <div className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-3 sm:px-6">
          <h2 className="text-lg font-bold">Contest Scheduler</h2>
          <button
            className="text-slate-400 hover:text-white transition-colors"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 sm:px-6">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Create Contest Button */}
          {!showCreateForm && (
            <button
              className="w-full bg-gradient-to-r from-primary to-indigo-600 text-white py-3 rounded-lg font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
              onClick={() => setShowCreateForm(true)}
              type="button"
              disabled={loading}
            >
              + Create New Contest
            </button>
          )}

          {/* Create Contest Form */}
          {showCreateForm && (
            <form onSubmit={handleCreateContest} className="border border-slate-700 rounded-lg p-4 space-y-4 bg-slate-950/50">
              <h3 className="font-bold text-white">Schedule New Contest</h3>

              <div className="grid grid-cols-2 gap-4">
                <label>
                  <span className="text-xs font-semibold text-slate-400 block mb-1">Date (Future Only)</span>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white text-sm outline-none focus:border-primary"
                  />
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-400 block mb-1">Time</span>
                  <input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white text-sm outline-none focus:border-primary"
                  />
                </label>
              </div>

              <label>
                <span className="text-xs font-semibold text-slate-400 block mb-1">Duration</span>
                <select
                  value={formData.durationHours}
                  onChange={(e) => setFormData({ ...formData, durationHours: parseInt(e.target.value) })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white text-sm outline-none focus:border-primary"
                >
                  <option value={1}>1 Hour</option>
                  <option value={2}>2 Hours</option>
                  <option value={3}>3 Hours</option>
                </select>
              </label>

              <label>
                <span className="text-xs font-semibold text-slate-400 block mb-2">Topics (Select at least 1)</span>
                <div className="grid grid-cols-2 gap-2">
                  {allTopics.map((topic) => (
                    <label key={topic} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.topics.includes(topic)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, topics: [...formData.topics, topic] });
                          } else {
                            setFormData({
                              ...formData,
                              topics: formData.topics.filter((t) => t !== topic),
                            });
                          }
                        }}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <span className="text-sm text-slate-400">{topic}</span>
                    </label>
                  ))}
                </div>
              </label>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary text-white py-2 rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Create Contest
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 border border-slate-700 text-slate-400 py-2 rounded-lg font-bold text-sm hover:border-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Running Contests */}
          {runningContests.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-green-400">🎮 Running Contests ({runningContests.length})</h3>
              {runningContests.map((contest) => (
                <div key={contest.contest_id} className="border border-green-500/30 rounded-lg p-3 bg-green-500/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-green-400">Duration: {contest.duration_seconds / 3600}h</p>
                      <p className="text-xs text-slate-400">Topics: {contest.topics.join(", ")}</p>
                      <p className="text-xs text-green-400">Started: {formatDateTime(contest.started_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming Contests */}
          {upcomingContests.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-blue-400">📋 Upcoming Contests ({upcomingContests.length})</h3>
              {upcomingContests.map((contest) => (
                <div key={contest.contest_id} className="border border-slate-700 rounded-lg p-3 bg-slate-950/50">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-white">
                        {formatDateTime(contest.scheduled_at)}
                        <span className={`ml-3 text-xs font-bold ${
                          contest.can_start ? "text-green-400" : "text-slate-500"
                        }`}>
                          in {getTimeUntil(contest.scheduled_at)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">Duration: {contest.duration_seconds / 3600}h</p>
                      <p className="text-xs text-slate-400">Topics: {contest.topics.join(", ")}</p>
                    </div>
                    <div className="flex gap-2">
                      {contest.can_start && (
                        <button
                          onClick={() => handleStartContest(contest.contest_id)}
                          disabled={loading}
                          className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          Start
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteContest(contest.contest_id)}
                        disabled={loading}
                        className="px-3 py-1 border border-red-500/50 text-red-400 text-xs font-bold rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed Contests */}
          {completedContests.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-500">✓ Completed Contests ({completedContests.length})</h3>
              {completedContests.map((contest) => (
                <div key={contest.contest_id} className="border border-slate-700/50 rounded-lg p-3 bg-slate-950/30 opacity-60">
                  <p className="text-xs text-slate-500">
                    {formatDateTime(contest.scheduled_at)} - Completed {formatDateTime(contest.completed_at)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {contests.length === 0 && !showCreateForm && (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">No contests scheduled yet</p>
              <p className="text-slate-500 text-xs mt-1">Create your first contest to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
