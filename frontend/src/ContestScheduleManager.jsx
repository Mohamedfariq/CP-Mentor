/**
 * Contest Schedule Manager Component
 * Manages creating, updating, deleting, and starting scheduled contests
 */

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "./api";

export function ContestScheduleManager({ open, authUser, onClose }) {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
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
      const response = await apiFetch("/api/contests/list", {
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
      const response = await apiFetch("/api/contests/create", {
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
    setLoading(true);
    try {
      const response = await apiFetch("/api/contests/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestId,
          codeforcesId: authUser.codeforces_id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Failed to delete contest");
      setDeleteTarget(null);
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
      const response = await apiFetch("/api/contests/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestId,
          codeforcesId: authUser.codeforces_id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "Failed to start contest");
      await loadContests();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp) => new Date(timestamp * 1000).toLocaleString();

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
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-2 sm:p-4 backdrop-blur-sm">
      <div className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-white/70 bg-[#f5f7fc] text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-bold">Contest Scheduler</h2>
            <p className="mt-1 text-[11px] text-slate-500">Create and manage scheduled practice contests.</p>
          </div>
          <button
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          {!showCreateForm ? (
            <button
              className="w-full rounded-2xl bg-gradient-to-r from-primary to-indigo-600 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(57,44,193,0.20)] transition-all hover:shadow-[0_18px_36px_rgba(57,44,193,0.24)] disabled:opacity-50"
              onClick={() => setShowCreateForm(true)}
              type="button"
              disabled={loading}
            >
              Create New Contest
            </button>
          ) : null}

          {showCreateForm ? (
            <form onSubmit={handleCreateContest} className="space-y-4 rounded-[22px] border border-slate-200 bg-white/90 p-4 shadow-sm">
              <h3 className="font-display text-base font-bold text-slate-900">Schedule New Contest</h3>

              <div className="grid grid-cols-2 gap-4">
                <label>
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Date</span>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Time</span>
                  <input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
                  />
                </label>
              </div>

              <label>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Duration</span>
                <select
                  value={formData.durationHours}
                  onChange={(e) => setFormData({ ...formData, durationHours: parseInt(e.target.value, 10) })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
                >
                  <option value={1}>1 Hour</option>
                  <option value={2}>2 Hours</option>
                  <option value={3}>3 Hours</option>
                </select>
              </label>

              <label>
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Topics</span>
                <div className="grid grid-cols-2 gap-2">
                  {allTopics.map((topic) => (
                    <label key={topic} className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
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
                        className="h-4 w-4 rounded accent-primary"
                      />
                      <span className="text-sm text-slate-700">{topic}</span>
                    </label>
                  ))}
                </div>
              </label>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  Create Contest
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {runningContests.length > 0 ? (
            <div className="space-y-2">
              <h3 className="font-display text-sm font-bold text-emerald-600">Running Contests ({runningContests.length})</h3>
              {runningContests.map((contest) => (
                <div key={contest.contest_id} className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="font-semibold text-emerald-700">Duration: {contest.duration_seconds / 3600}h</p>
                  <p className="text-xs text-slate-500">Topics: {contest.topics.join(", ")}</p>
                  <p className="text-xs text-emerald-600">Started: {formatDateTime(contest.started_at)}</p>
                </div>
              ))}
            </div>
          ) : null}

          {upcomingContests.length > 0 ? (
            <div className="space-y-2">
              <h3 className="font-display text-sm font-bold text-slate-900">Upcoming Contests ({upcomingContests.length})</h3>
              {upcomingContests.map((contest) => (
                <div key={contest.contest_id} className="rounded-[20px] border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">
                        {formatDateTime(contest.scheduled_at)}
                        <span className={`ml-3 text-xs font-bold ${contest.can_start ? "text-emerald-600" : "text-slate-500"}`}>
                          in {getTimeUntil(contest.scheduled_at)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">Duration: {contest.duration_seconds / 3600}h</p>
                      <p className="text-xs text-slate-500">Topics: {contest.topics.join(", ")}</p>
                    </div>
                    <div className="flex gap-2">
                      {contest.can_start ? (
                        <button
                          onClick={() => handleStartContest(contest.contest_id)}
                          disabled={loading}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Start
                        </button>
                      ) : null}
                      <button
                        onClick={() => setDeleteTarget(contest)}
                        disabled={loading}
                        className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {completedContests.length > 0 ? (
            <div className="space-y-2">
              <h3 className="font-display text-sm font-bold text-slate-500">Completed Contests ({completedContests.length})</h3>
              {completedContests.map((contest) => (
                <div key={contest.contest_id} className="rounded-[20px] border border-slate-200 bg-slate-100/80 p-3 opacity-80">
                  <p className="text-xs text-slate-500">
                    {formatDateTime(contest.scheduled_at)} - Completed {formatDateTime(contest.completed_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {contests.length === 0 && !showCreateForm ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500">No contests scheduled yet</p>
              <p className="mt-1 text-xs text-slate-400">Create your first contest to get started</p>
            </div>
          ) : null}
        </div>

        {deleteTarget ? (
          <div className="border-t border-slate-200 bg-white/80 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 rounded-[20px] border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-600">Delete this scheduled contest?</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDateTime(deleteTarget.scheduled_at)} - {deleteTarget.topics.join(", ")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                  onClick={() => setDeleteTarget(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white"
                  onClick={() => handleDeleteContest(deleteTarget.contest_id)}
                  type="button"
                  disabled={loading}
                >
                  {loading ? "Deleting..." : "Delete Contest"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
