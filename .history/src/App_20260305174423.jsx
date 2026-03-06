import { useCallback, useEffect, useRef, useState } from "react";

const topicAccuracy = [
  { topic: "Dynamic Programming", value: 85 },
  { topic: "Graphs & Trees", value: 70 },
  { topic: "Greedy Algorithms", value: 92 },
  { topic: "Binary Search", value: 65 },
  { topic: "Number Theory", value: 50 },
];

const recentSubmissions = [
  { name: "C. Minimum Ties", topic: "Graphs", verdict: "Accepted", tone: "green", time: "2h ago" },
  { name: "B. Array Reodering", topic: "Greedy", verdict: "Wrong Answer", tone: "red", time: "5h ago" },
  {
    name: "D. GCD and MST",
    topic: "Math",
    verdict: "Time Limit Exceeded",
    tone: "yellow",
    time: "Yesterday",
  },
  { name: "A. Add and Divide", topic: "Math", verdict: "Accepted", tone: "green", time: "Yesterday" },
  { name: "E. Advertising Agency", topic: "DP", verdict: "Accepted", tone: "green", time: "2 days ago" },
];

const verdictStyles = {
  green: "bg-green-500/10 text-green-500",
  red: "bg-red-500/10 text-red-500",
  yellow: "bg-yellow-500/10 text-yellow-500",
};

const AUTH_USER_STORAGE_KEY = "cpmentor.auth_user";

const loadStoredAuthUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const formatTopicLabel = (topic) => {
  const normalized = String(topic || "").trim();
  if (!normalized) return "Unknown";
  return normalized
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
};

const difficultyFromRating = (rating) => {
  const value = Number(rating);
  if (!Number.isFinite(value) || value <= 0) {
    return { label: "Unrated", cls: "bg-slate-500/10 text-slate-300 border border-slate-500/20" };
  }
  if (value < 1200) {
    return { label: "Easy", cls: "bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20" };
  }
  if (value < 1700) {
    return { label: "Medium", cls: "bg-accent-amber/10 text-accent-amber border border-accent-amber/20" };
  }
  return { label: "Hard", cls: "bg-accent-rose/10 text-accent-rose border border-accent-rose/20" };
};

const platformStyles = {
  Codeforces: {
    badge: "bg-blue-500/10 text-blue-500 border border-blue-500/20",
    accent: "text-primary",
  },
  LeetCode: {
    badge: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    accent: "text-amber-500",
  },
};

const formatLocalDateTime = (isoString) => {
  if (!isoString) return "TBD";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDuration = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return "TBD";
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours <= 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hours`;
  return `${hours}h ${minutes}m`;
};

const formatTimeUntil = (isoString) => {
  if (!isoString) return "Time TBD";
  const start = new Date(isoString).getTime();
  if (Number.isNaN(start)) return "Time TBD";
  const diffMs = start - Date.now();
  if (diffMs <= 0) return "Starting soon";
  const diffMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMinutes / (60 * 24));
  const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
  const minutes = diffMinutes % 60;
  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
  return `Starts in ${minutes}m`;
};

const formatCountdown = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const CODE_EDITOR_LANGUAGES = [
  { value: "cpp23", label: "GNU G++23 (C++23)" },
  { value: "cpp20", label: "GNU G++20 (C++20)" },
  { value: "cpp17", label: "GNU G++17 (C++17)" },
  { value: "c", label: "GNU GCC 11 (C)" },
  { value: "python3", label: "Python 3.13.2" },
  { value: "java", label: "Java 21 64bit" },
  { value: "go", label: "Go 1.22.2" },
  { value: "rust", label: "Rust 1.89.0" },
  { value: "javascript", label: "JavaScript (Node.js 15.8.0)" },
  { value: "kotlin", label: "Kotlin 1.9.21" },
  { value: "csharp", label: "C# 10 .NET SDK 6.0" },
];

const CODE_EDITOR_TEMPLATES = {
  cpp23: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // write solution here

    return 0;
}
`,
  cpp20: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // write solution here

    return 0;
}
`,
  cpp17: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // write solution here

    return 0;
}
`,
  c: `#include <stdio.h>

int main() {
    // write solution here
    return 0;
}
`,
  python3: `def solve():
    # write solution here
    pass


if __name__ == "__main__":
    solve()
`,
  java: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        FastScanner fs = new FastScanner(System.in);
        StringBuilder out = new StringBuilder();

        // write solution here

        System.out.print(out.toString());
    }

    private static final class FastScanner {
        private final InputStream in;
        private final byte[] buffer = new byte[1 << 16];
        private int ptr = 0, len = 0;

        FastScanner(InputStream is) {
            this.in = is;
        }

        private int read() throws IOException {
            if (ptr >= len) {
                len = in.read(buffer);
                ptr = 0;
                if (len <= 0) return -1;
            }
            return buffer[ptr++];
        }

        String next() throws IOException {
            StringBuilder sb = new StringBuilder();
            int c;
            while ((c = read()) != -1 && c <= ' ') {}
            if (c == -1) return null;
            do {
                sb.append((char) c);
                c = read();
            } while (c > ' ');
            return sb.toString();
        }
    }
}
`,
  go: `package main

import "fmt"

func main() {
    // write solution here
}
`,
  rust: `fn main() {
    // write solution here
}
`,
  javascript: `const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (line) => {
    // write solution here
});
`,
  kotlin: `fun main() {
    // write solution here
}
`,
  csharp: `using System;

class Program {
    static void Main() {
        // write solution here
    }
}
`,
};

const starterCodeForLanguage = (language) => CODE_EDITOR_TEMPLATES[language] || CODE_EDITOR_TEMPLATES.cpp23;

const normalizeCodeforcesProblemUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (value.startsWith("codeforces.com/")) {
    return `https://${value}`;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://${value}`;
};

const buildCodeforcesSubmitUrl = (problemUrl) => {
  const normalized = normalizeCodeforcesProblemUrl(problemUrl);
  if (!normalized) return "";
  const contestMatch = normalized.match(/codeforces\.com\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (contestMatch) {
    return `https://codeforces.com/contest/${contestMatch[1]}/submit`;
  }
  const problemsetMatch = normalized.match(/codeforces\.com\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
  if (problemsetMatch) {
    return `https://codeforces.com/problemset/submit?contestId=${problemsetMatch[1]}&problemIndex=${problemsetMatch[2]}`;
  }
  return normalized;
};

const copyText = async (text) => {
  const value = String(text || "");
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = value;
    fallback.style.position = "fixed";
    fallback.style.opacity = "0";
    document.body.appendChild(fallback);
    fallback.focus();
    fallback.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    document.body.removeChild(fallback);
    return copied;
  }
};

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">{title || "Please Confirm"}</h3>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-slate-300">{message || "Are you sure?"}</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-700 px-4 py-3">
          <button
            className="rounded border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`rounded px-3 py-1.5 text-xs font-semibold text-white ${
              danger ? "bg-red-600 hover:bg-red-500" : "bg-primary hover:bg-primary/90"
            }`}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function useThemedConfirm() {
  const [dialogState, setDialogState] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    danger: false,
  });
  const resolverRef = useRef(null);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }
    };
  }, []);

  const askConfirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        open: true,
        title: options.title || "Please Confirm",
        message: options.message || "Are you sure?",
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        danger: Boolean(options.danger),
      });
    });
  }, []);

  const resolveDialog = useCallback((value) => {
    setDialogState((prev) => ({ ...prev, open: false }));
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
  }, []);

  const confirmDialogNode = (
    <ConfirmDialog
      open={dialogState.open}
      title={dialogState.title}
      message={dialogState.message}
      confirmLabel={dialogState.confirmLabel}
      cancelLabel={dialogState.cancelLabel}
      danger={dialogState.danger}
      onCancel={() => resolveDialog(false)}
      onConfirm={() => resolveDialog(true)}
    />
  );

  return { askConfirm, confirmDialogNode };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const computeWeeklyContestWindow = (schedule, durationSeconds, nowMs = Date.now()) => {
  const durationMs = Math.max(1, Number(durationSeconds) || 1) * 1000;
  const out = {
    hasSchedule: false,
    isOpenNow: false,
    windowStartMs: 0,
    windowEndMs: 0,
    nextWindowStartMs: 0,
  };
  if (!schedule || typeof schedule !== "object") return out;

  const weekday = Number(schedule.weekday);
  const hour = Number(schedule.hour);
  const minute = Number(schedule.minute);
  const tzOffsetMinutes = Number(schedule.timezone_offset_minutes ?? schedule.timezoneOffsetMinutes ?? 0);
  if (
    !Number.isFinite(weekday) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(tzOffsetMinutes) ||
    weekday < 0 ||
    weekday > 6 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return out;
  }

  const localNowMs = nowMs - tzOffsetMinutes * 60 * 1000;
  const localNow = new Date(localNowMs);
  const localWeekday = localNow.getUTCDay();
  const localTodayScheduledMs = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate(),
    hour,
    minute,
    0,
    0
  );

  let daysBack = (localWeekday - weekday + 7) % 7;
  let windowStartLocalMs = localTodayScheduledMs - daysBack * 24 * 60 * 60 * 1000;
  if (daysBack === 0 && localNowMs < localTodayScheduledMs) {
    windowStartLocalMs -= WEEK_MS;
  }

  const windowStartMs = windowStartLocalMs + tzOffsetMinutes * 60 * 1000;
  const windowEndMs = windowStartMs + durationMs;
  const isOpenNow = nowMs >= windowStartMs && nowMs < windowEndMs;

  out.hasSchedule = true;
  out.isOpenNow = isOpenNow;
  out.windowStartMs = windowStartMs;
  out.windowEndMs = windowEndMs;
  out.nextWindowStartMs = windowStartMs + WEEK_MS;
  return out;
};

const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const buildCalendarDays = (monthDate, contestDates) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = 0; i < 42; i += 1) {
    const dayIndex = i - startWeekday + 1;
    const inMonth = dayIndex >= 1 && dayIndex <= daysInMonth;
    const date = inMonth
      ? new Date(year, month, dayIndex)
      : dayIndex < 1
        ? new Date(year, month - 1, daysInPrevMonth + dayIndex)
        : new Date(year, month + 1, dayIndex - daysInMonth);
    const key = dateKey(date);
    const hasContest = contestDates.has(key);
    const isToday = dateKey(new Date()) === key;
    cells.push({ key, date, inMonth, hasContest, isToday });
  }

  return cells;
};

function ProblemEditorModal({ open, problem, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [editorTheme, setEditorTheme] = useState("dark");
  const [language, setLanguage] = useState("cpp23");
  const [code, setCode] = useState(() => starterCodeForLanguage("cpp23"));
  const [copyStatus, setCopyStatus] = useState("");
  const [testResults, setTestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const { askConfirm, confirmDialogNode } = useThemedConfirm();

  const cfLink = normalizeCodeforcesProblemUrl(problem?.cf_link || "");

  useEffect(() => {
    if (!open) return;
    setCopyStatus("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLanguage("cpp23");
    setCode(starterCodeForLanguage("cpp23"));
  }, [open, problem?.problem_key, problem?.cf_link]);

  useEffect(() => {
    if (!open || !cfLink) {
      setDetails(null);
      setFetchError("");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setFetchError("");
    setDetails(null);

    const loadDetails = async () => {
      try {
        const response = await fetch("/api/problem/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ cfLink }),
        });
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json") ? await response.json() : null;
        if (!response.ok) {
          throw new Error(data?.detail || `Unable to load problem details (HTTP ${response.status})`);
        }
        if (!cancelled) {
          setDetails(data);
        }
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setFetchError(err?.message || "Failed to load problem details");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDetails();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [cfLink, open]);

  if (!open) return null;

  const isDarkEditor = editorTheme === "dark";
  const panelClass = isDarkEditor
    ? "border-slate-700 bg-slate-900 text-slate-100"
    : "border-slate-200 bg-white text-slate-900";
  const cardClass = isDarkEditor ? "border-slate-700 bg-slate-950/60" : "border-slate-200 bg-slate-50";
  const inputClass = isDarkEditor
    ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400";
  const submitUrl = details?.submit_url || buildCodeforcesSubmitUrl(cfLink);
  const sourceUrl = details?.source_url || cfLink;
  const title = details?.title || problem?.title || problem?.problem_name || "Problem";
  const samples = Array.isArray(details?.samples) ? details.samples : [];
  const constraints = Array.isArray(details?.constraints) ? details.constraints : [];

  const handleLanguageChange = async (nextLanguage) => {
    if (nextLanguage === language) return;
    const currentTemplate = starterCodeForLanguage(language).trim();
    const nextTemplate = starterCodeForLanguage(nextLanguage);
    const hasCustomCode = code.trim() && code.trim() !== currentTemplate;
    if (hasCustomCode) {
      const shouldReplace = await askConfirm({
        title: "Replace Existing Code?",
        message: "Switching language can replace your current code with a starter template.",
        confirmLabel: "Replace Code",
      });
      if (!shouldReplace) {
        setLanguage(nextLanguage);
        return;
      }
    }
    setLanguage(nextLanguage);
    setCode(nextTemplate);
  };

  const handleCopyCode = async () => {
    const copied = await copyText(code);
    setCopyStatus(copied ? "Code copied to clipboard." : "Unable to copy code. Please copy manually.");
  };

  const handleOpenSubmit = () => {
    if (!submitUrl && !sourceUrl) return;
    window.open(submitUrl || sourceUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyAndOpenSubmit = async () => {
    if (!submitUrl && !sourceUrl) return;
    const opened = window.open(submitUrl || sourceUrl, "_blank", "noopener,noreferrer");
    const copied = await copyText(code);
    if (copied) {
      setCopyStatus(opened ? "Code copied. Paste it in Codeforces submit page." : "Code copied. Allow pop-ups to open submit page.");
      return;
    }
    setCopyStatus("Unable to copy code. Please copy manually before submitting.");
  };

  const handleRunCode = async () => {
    if (!code.trim()) {
      setRunError("Code cannot be empty");
      setTestResults(null);
      return;
    }
    if (!samples || samples.length === 0) {
      setRunError("No sample test cases available");
      setTestResults(null);
      return;
    }

    setIsRunning(true);
    setRunError("");
    setTestResults(null);

    try {
      const response = await fetch("/api/execute-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          testCases: samples.map((s) => ({
            input: s.input || "",
            expectedOutput: s.output || "",
            index: s.index,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setRunError(data?.detail || "Failed to execute code");
        setTestResults(null);
        return;
      }

      setTestResults(data);
    } catch (err) {
      setRunError(err?.message || "Error executing code");
      setTestResults(null);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-2 sm:p-4">
      <div className={`flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border ${panelClass}`}>
        <div className="flex items-center justify-between gap-3 border-b border-current/10 px-3 py-2 sm:px-4 sm:py-3">
          <div>
            <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
            <p className={`text-[11px] ${isDarkEditor ? "text-slate-400" : "text-slate-500"}`}>
              {problem?.topic ? `Topic: ${formatTopicLabel(problem.topic)} | ` : ""}
              {details?.time_limit ? `Time: ${details.time_limit}` : "Time: -"}
              {" | "}
              {details?.memory_limit ? `Memory: ${details.memory_limit}` : "Memory: -"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`rounded px-2 py-1 text-xs font-semibold ${isDarkEditor ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"}`}
              onClick={() => setEditorTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              type="button"
            >
              {isDarkEditor ? "Light Mode" : "Dark Mode"}
            </button>
            <button
              className={`rounded px-2 py-1 text-xs ${isDarkEditor ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"}`}
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-2 lg:gap-4 lg:p-4">
          <section className={`min-h-0 overflow-y-auto rounded-lg border p-3 text-sm ${cardClass}`}>
            {loading ? <p className={isDarkEditor ? "text-slate-300" : "text-slate-600"}>Loading problem statement...</p> : null}
            {fetchError ? <p className="text-sm text-red-400">{fetchError}</p> : null}
            {!loading && !fetchError ? (
              <div className="space-y-4">
                <div>
                  <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">Statement</h4>
                  {details?.statement ? (
                    <pre className={`whitespace-pre-wrap text-xs leading-relaxed ${isDarkEditor ? "text-slate-200" : "text-slate-700"}`}>
                      {details.statement}
                    </pre>
                  ) : (
                    <p className={isDarkEditor ? "text-slate-400" : "text-slate-500"}>Statement preview is unavailable.</p>
                  )}
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">Input</h4>
                  <pre className={`whitespace-pre-wrap text-xs leading-relaxed ${isDarkEditor ? "text-slate-200" : "text-slate-700"}`}>
                    {details?.input_specification || "Input specification unavailable."}
                  </pre>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">Output</h4>
                  <pre className={`whitespace-pre-wrap text-xs leading-relaxed ${isDarkEditor ? "text-slate-200" : "text-slate-700"}`}>
                    {details?.output_specification || "Output specification unavailable."}
                  </pre>
                </div>
                {constraints.length > 0 ? (
                  <div>
                    <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">Constraints (Detected)</h4>
                    <ul className={`list-disc space-y-1 pl-4 text-xs ${isDarkEditor ? "text-slate-300" : "text-slate-700"}`}>
                      {constraints.map((item, idx) => (
                        <li key={`${idx}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {samples.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Sample Tests</h4>
                    {samples.map((sample) => (
                      <div className={`rounded border p-2 ${isDarkEditor ? "border-slate-700 bg-slate-950/70" : "border-slate-200 bg-white"}`} key={sample.index}>
                        <p className={`mb-1 text-[11px] font-semibold ${isDarkEditor ? "text-slate-300" : "text-slate-600"}`}>Sample {sample.index}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className={`mb-1 text-[10px] uppercase tracking-wide ${isDarkEditor ? "text-slate-400" : "text-slate-500"}`}>Input</p>
                            <pre className={`whitespace-pre-wrap text-[11px] ${isDarkEditor ? "text-slate-200" : "text-slate-700"}`}>{sample.input || "-"}</pre>
                          </div>
                          <div>
                            <p className={`mb-1 text-[10px] uppercase tracking-wide ${isDarkEditor ? "text-slate-400" : "text-slate-500"}`}>Output</p>
                            <pre className={`whitespace-pre-wrap text-[11px] ${isDarkEditor ? "text-slate-200" : "text-slate-700"}`}>{sample.output || "-"}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {details?.note ? (
                  <div>
                    <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">Note</h4>
                    <pre className={`whitespace-pre-wrap text-xs leading-relaxed ${isDarkEditor ? "text-slate-200" : "text-slate-700"}`}>
                      {details.note}
                    </pre>
                  </div>
                ) : null}
                {sourceUrl ? (
                  <a className="text-xs text-primary underline" href={sourceUrl} rel="noreferrer" target="_blank">
                    Open original problem on Codeforces
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className={`flex min-h-0 flex-col rounded-lg border p-3 ${cardClass}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className={`text-xs font-semibold ${isDarkEditor ? "text-slate-300" : "text-slate-700"}`}>
                Language
                <select
                  className={`ml-2 rounded border px-2 py-1 text-xs ${inputClass}`}
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                >
                  {CODE_EDITOR_LANGUAGES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-600"
                  onClick={handleCopyCode}
                  type="button"
                >
                  Copy Code
                </button>
                <button
                  className="rounded border border-primary px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                  onClick={handleOpenSubmit}
                  type="button"
                >
                  Open CF Submit
                </button>
                <button
                  className="rounded bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary/90"
                  onClick={handleCopyAndOpenSubmit}
                  type="button"
                >
                  Copy + Open Submit
                </button>
                <button
                  className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleRunCode}
                  type="button"
                  disabled={isRunning}
                >
                  {isRunning ? "Running..." : "Run Code"}
                </button>
              </div>
            </div>
            {copyStatus ? <p className={`mb-2 text-xs ${isDarkEditor ? "text-emerald-300" : "text-emerald-700"}`}>{copyStatus}</p> : null}
            <textarea
              className={`min-h-0 flex-1 resize-none rounded border p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary ${inputClass}`}
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </section>
        </div>
        {confirmDialogNode}
      </div>
    </div>
  );
}

function SignUpPage({ onGoToLogin, onAuthSuccess }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codeforcesId, setCodeforcesId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, codeforcesId }),
      });

      let data = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        setErrorMessage(
          data?.alert || data?.message || data?.detail || `Unable to sign up (HTTP ${response.status}). Check backend server logs.`
        );
        return;
      }

      onAuthSuccess(data?.user ?? null);
    } catch {
      setErrorMessage("Cannot reach backend API. Start FastAPI with `python -m uvicorn api.main:app --reload --port 5000`.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ minHeight: "max(884px, 100dvh)" }}
    >
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-glow-blue pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-glow-purple pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary/20 p-3 rounded-xl mb-3 border border-primary/30">
            <span className="material-symbols-outlined text-primary text-3xl">terminal</span>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight font-display">CP Mentor</h1>
          <p className="text-slate-400 text-sm mt-1">Join the developer leaderboard</p>
        </div>

        <div className="glass-card rounded-xl p-6 md:p-8 shadow-2xl">
          <h2 className="text-white text-xl font-semibold mb-6">Create Your Account</h2>
          <form
            className="space-y-5"
            onSubmit={handleSignUp}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">Username</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xl">
                  person
                </span>
                <input
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 pl-11 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  placeholder="your_username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">Email Address</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xl">
                  mail
                </span>
                <input
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 pl-11 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  placeholder="dev@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xl">
                  lock
                </span>
                <input
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 pl-11 pr-11 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  placeholder="********"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  type="button"
                >
                  <span className="material-symbols-outlined text-xl">visibility</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">Codeforces ID</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xl">
                  code
                </span>
                <input
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 pl-11 pr-4 text-white placeholder:text-slate-600 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  placeholder="tourist"
                  type="text"
                  value={codeforcesId}
                  onChange={(e) => setCodeforcesId(e.target.value)}
                  required
                />
              </div>
              <p className="text-[11px] text-primary/80 flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-[14px]">info</span>
                We&apos;ll use this to sync your contest data.
              </p>
            </div>

            {errorMessage ? <p className="text-red-400 text-sm">{errorMessage}</p> : null}

            <button
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-70 text-white font-semibold py-3.5 rounded-lg shadow-[0_0_20px_rgba(37,106,244,0.3)] transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
              type="submit"
              disabled={isSubmitting}
            >
              <span>{isSubmitting ? "Signing Up..." : "Sign Up"}</span>
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-sm mt-8">
          Already have an account?
          <button
            className="text-primary font-semibold hover:underline ml-1"
            onClick={onGoToLogin}
            type="button"
          >
            Log in
          </button>
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 px-6 py-3 flex justify-around items-center md:hidden">
        <a className="text-slate-500 hover:text-primary transition-colors flex flex-col items-center gap-1" href="#">
          <span className="material-symbols-outlined">home</span>
          <span className="text-[10px]">Home</span>
        </a>
        <a className="text-slate-500 hover:text-primary transition-colors flex flex-col items-center gap-1" href="#">
          <span className="material-symbols-outlined">trophy</span>
          <span className="text-[10px]">Leaderboard</span>
        </a>
        <a className="text-primary flex flex-col items-center gap-1" href="#">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px]">Profile</span>
        </a>
      </div>
    </div>
  );
}

function LoginPage({ onGoToSignup, onAuthSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        setErrorMessage(data?.alert || data?.message || data?.detail || "Invalid email or password");
        return;
      }

      onAuthSuccess(data?.user ?? null);
    } catch {
      setErrorMessage("Cannot reach backend API. Start FastAPI with `python -m uvicorn api.main:app --reload --port 5000`.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="bg-background-light dark:bg-background-dark flex items-center justify-center p-4 selection:bg-primary/30 relative overflow-hidden"
      style={{ minHeight: "max(884px, 100dvh)" }}
    >
      <div className="fixed inset-0 overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-[440px]">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary p-2.5 rounded-xl shadow-lg shadow-primary/20 mb-3">
            <span className="material-symbols-outlined text-white text-3xl block">terminal</span>
          </div>
          <h2 className="text-white text-xl font-bold tracking-tight">CP Mentor</h2>
        </div>

        <div className="glass-card rounded-2xl p-8 shadow-2xl">
          <div className="mb-8">
            <h1 className="text-white text-3xl font-bold tracking-tight mb-2">Welcome Back</h1>
            <p className="text-slate-400 text-sm">Elevate your competitive programming skills.</p>
          </div>

          <form
            className="space-y-5"
            onSubmit={handleLogin}
          >
            <div className="space-y-2">
              <label className="text-slate-300 text-sm font-medium ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <input
                  className="w-full bg-slate-900/50 border border-slate-700 text-white text-sm rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-600"
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-slate-300 text-sm font-medium">Password</label>
                <a className="text-primary text-xs font-semibold hover:underline" href="#">
                  Forgot Password?
                </a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <input
                  className="w-full bg-slate-900/50 border border-slate-700 text-white text-sm rounded-xl py-3.5 pl-11 pr-11 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-600"
                  placeholder="********"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">visibility</span>
                </button>
              </div>
            </div>

            {errorMessage ? <p className="text-red-400 text-sm">{errorMessage}</p> : null}

            <button
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-70 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] mt-2"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Logging In..." : "Log In"}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-slate-500 font-medium">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              <img
                alt="Google logo icon"
                className="w-4 h-4"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA4Q1KPdd5j0CC4jmfRphzmapBtiiPcL2uTSfGb19hL7SZE3YESzyvRLz6rxx_-GEDQeSWvP1U5NQkfFKb8anFGBMlFqlfRShz-4b1CUCnZL1uqj_P4JhKb3kL-F0B__FJn_fFRN4qnLWAYAiTO6Tg_I20hIkMzEWQhpMMuqWFgOp4zDq7ZiuT0Ax07xDkuI0mdW14Re9v5Xw2GiPFAQWPg-uHp6rE183sMhUD6yL5yYDVa9vpIhUgdvFyBgUxgwQL47zCfH2JCVts"
              />
              Google
            </button>
            <button className="flex items-center justify-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              <span className="material-symbols-outlined text-[18px]">terminal</span>
              GitHub
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-slate-400 text-sm">
          Don&apos;t have an account?
          <button
            className="text-primary font-semibold hover:underline decoration-2 underline-offset-4 ml-1"
            onClick={onGoToSignup}
            type="button"
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}

function DashboardPage({
  onOpenPersonalizedSheet,
  onOpenPersonalizedContest,
  onOpenUpcoming,
  onLogout,
  authUser,
  cachedDashboard,
  onDashboardData,
}) {
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [submissionModal, setSubmissionModal] = useState({ open: false, loading: false, error: "", payload: null });
  const activeDashboardRequestRef = useRef(null);
  const { askConfirm, confirmDialogNode } = useThemedConfirm();

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    const codeforcesId = authUser?.codeforces_id;
    if (!codeforcesId) return;

    if (activeDashboardRequestRef.current) {
      activeDashboardRequestRef.current.abort();
    }
    const controller = new AbortController();
    activeDashboardRequestRef.current = controller;

    setDashboardLoading(!silent);
    if (!silent) {
      setDashboardError("");
    }
    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeforcesId }),
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.detail || `Unable to load dashboard (HTTP ${response.status})`);
      }
      setDashboardData(data);
      onDashboardData?.(data);
      setDashboardError("");
    } catch (err) {
      if (err?.name === "AbortError") {
        return;
      }
      if (!silent) {
        setDashboardError(err?.message || "Failed to load dashboard");
      }
    } finally {
      if (!controller.signal.aborted) {
        setDashboardLoading(false);
      }
    }
  }, [authUser?.codeforces_id, onDashboardData]);

  useEffect(() => {
    if (cachedDashboard && cachedDashboard.codeforces_id === authUser?.codeforces_id) {
      setDashboardData(cachedDashboard);
      setDashboardError("");
      fetchDashboard({ silent: true });
      return;
    }
    fetchDashboard({ silent: false });
  }, [authUser?.codeforces_id, cachedDashboard, fetchDashboard]);

  useEffect(() => {
    return () => {
      if (activeDashboardRequestRef.current) {
        activeDashboardRequestRef.current.abort();
      }
    };
  }, []);

  const topicAccuracyRows =
    dashboardData?.topic_accuracy && dashboardData.topic_accuracy.length > 0
      ? dashboardData.topic_accuracy
      : topicAccuracy;
  const recentSubmissionRows =
    dashboardData?.recent_submissions && dashboardData.recent_submissions.length > 0
      ? dashboardData.recent_submissions
      : recentSubmissions;
  const ratingDelta = Number(dashboardData?.rating_delta || 0);
  const ratingDeltaLabel = `${ratingDelta >= 0 ? "+" : ""}${ratingDelta}`;
  const lastSyncedLabel = dashboardData?.last_synced
    ? new Date(dashboardData.last_synced * 1000).toLocaleString()
    : "Not synced";
  const weakTopicProgressRows = Array.isArray(dashboardData?.weak_topic_progress)
    ? dashboardData.weak_topic_progress
    : [];
  const latestContestResult = dashboardData?.latest_contest_result || null;
  const latestContestCompletedLabel = latestContestResult?.completed_at
    ? new Date(Number(latestContestResult.completed_at) * 1000).toLocaleString()
    : "No contest completed yet";
  const weeklySchedule = dashboardData?.weekly_contest_schedule || null;
  const nextWeeklyContestLabel = weeklySchedule?.next_contest_at
    ? new Date(Number(weeklySchedule.next_contest_at) * 1000).toLocaleString()
    : "Not scheduled";
  const clusterLabel = dashboardData?.cluster_current || "C0";

  const openSubmissionInApp = async (url) => {
    if (!url) return;
    setSubmissionModal({ open: true, loading: true, error: "", payload: null });
    try {
      const response = await fetch("/api/submission/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionUrl: url }),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.detail || `Unable to load submission source (HTTP ${response.status})`);
      }
      setSubmissionModal({ open: true, loading: false, error: "", payload: data });
    } catch (err) {
      setSubmissionModal({
        open: true,
        loading: false,
        error: err?.message || "Failed to load submission source",
        payload: { submission_url: url },
      });
    }
  };

  const handleLogoutClick = async () => {
    const shouldLogout = await askConfirm({
      title: "Logout?",
      message: "Do you want to log out from CP Mentor on this device?",
      confirmLabel: "Logout",
      danger: true,
    });
    if (!shouldLogout) return;
    onLogout?.();
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen pb-24 md:pb-0 md:pl-64">
      <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-card-dark md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined">terminal</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">CP Tracker</h1>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          <a className="flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2 text-primary" href="#">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-medium">Dashboard</span>
          </a>
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onOpenPersonalizedSheet}
            type="button"
          >
            <span className="material-symbols-outlined">description</span>
            <span className="font-medium">Personalized Sheet</span>
          </button>
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onOpenPersonalizedContest}
            type="button"
          >
            <span className="material-symbols-outlined">emoji_events</span>
            <span className="font-medium">Personalized Contest</span>
          </button>
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onOpenUpcoming}
            type="button"
          >
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="font-medium">Upcoming Contest</span>
          </button>
        </nav>

        <div className="mt-auto rounded-xl bg-slate-100 p-4 dark:bg-slate-800/50">
          <button
            className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
            onClick={handleLogoutClick}
            type="button"
            title="Open logout"
          >
            <div
              className="h-10 w-10 rounded-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAq887wRBDbiCSDU6K95-YpV9iKeikbvwxJ-b0eW5bVgf2YrA-dgR9dt1hLIAZ_UMhBPBdnzSTGHBHOQRhHKmK8dlvyIIZw5zGfvuwW02yUZJU5F_kU8diZLDEgb4dblcgSVFE9Hyi4uib3Tcb79kkntBzVXXfBNyqrhmtVsV1TYTo6YStgPCO02gFSxXdV4s2RqaZp0st-Bxy9PttyCTbJ4ebDXMjmOJFyb26cmVBHwm98VKRdyMO1Jt2dUkfBpchC32T0OErsXjI')",
              }}
            ></div>
            <div>
              <p className="text-sm font-bold">{dashboardData?.username || authUser?.username || "user"}</p>
              <p className="text-xs text-slate-500">{dashboardData?.rank || "unrated"}</p>
            </div>
            <span className="material-symbols-outlined ml-auto text-slate-500">logout</span>
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-background-dark/80 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined text-lg">terminal</span>
          </div>
          <span className="font-bold">CP Tracker</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 disabled:opacity-60"
            disabled={dashboardLoading || !authUser?.codeforces_id}
            onClick={fetchDashboard}
            type="button"
          >
            <span className="material-symbols-outlined">sync</span>
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
            onClick={handleLogoutClick}
            type="button"
            title="Logout"
          >
            <span className="material-symbols-outlined">person</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">
              Welcome back,{" "}
              <span className="text-accent-purple">
                {dashboardData?.username || authUser?.username || "coder"}
              </span>
            </h2>
            <p className="mt-1 text-slate-500 dark:text-slate-400">Last synced: {lastSyncedLabel}</p>
          </div>
          <button
            className="hidden items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-70 md:flex"
            disabled={dashboardLoading || !authUser?.codeforces_id}
            onClick={fetchDashboard}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">sync</span>
            {dashboardLoading ? "Syncing..." : "Sync Profile"}
          </button>
        </div>

        {dashboardLoading ? (
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            Loading dashboard data from Codeforces...
          </p>
        ) : null}
        {dashboardError ? <p className="mb-6 text-sm text-red-500">{dashboardError}</p> : null}

        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            <h3 className="text-lg font-bold">Codeforces Stats</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-dark">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Current Rating</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-accent-purple">{dashboardData?.current_rating ?? 0}</span>
                <span className={`text-xs font-semibold ${ratingDelta >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {ratingDeltaLabel}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full bg-accent-purple"
                  style={{ width: `${Math.min(Math.max(((dashboardData?.current_rating ?? 0) / 3500) * 100, 0), 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-dark">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Max Rating</span>
              <span className="text-3xl font-bold">{dashboardData?.max_rating ?? 0}</span>
              <span className="text-xs text-slate-400">{dashboardData?.max_rank || "unrated"} peak</span>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-dark">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Friends Count</span>
              <span className="text-3xl font-bold text-primary">{dashboardData?.friend_of_count ?? 0}</span>
              <span className="text-xs text-slate-400">Contribution: {dashboardData?.contribution ?? 0}</span>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-dark">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Problems Solved</span>
              <span className="text-3xl font-bold">{dashboardData?.problems_solved ?? 0}</span>
              <span className="text-xs text-slate-400">Codeforces accepted problems</span>
            </div>
          </div>
        </section>

        <section className="mb-10 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-dark">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Weak Topic Progress</h3>
              <span className="text-[11px] text-slate-500">Needs focus</span>
            </div>
            {weakTopicProgressRows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No weak-topic data yet.</p>
            ) : (
              <div className="space-y-3">
                {weakTopicProgressRows.slice(0, 5).map((topic) => {
                  const weakness = Math.max(0, Number(topic.weakness_score || 0));
                  const barPct = Math.min(100, Math.max(8, Math.round(weakness * 35)));
                  return (
                    <div key={topic.topic}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{formatTopicLabel(topic.topic_label || topic.topic)}</span>
                        <span className="text-slate-500">
                          {topic.solved_unique || 0}/{topic.attempted_unique || 0}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-accent-rose" style={{ width: `${barPct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-dark">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Latest Contest Result</h3>
              <span className="text-[11px] text-slate-500">{latestContestCompletedLabel}</span>
            </div>
            {latestContestResult ? (
              <div className="space-y-2 text-sm">
                <p>
                  Solved:{" "}
                  <span className="font-semibold">
                    {latestContestResult.solved_count || 0}/{latestContestResult.total_problems || 0}
                  </span>
                </p>
                <p>
                  Score:{" "}
                  <span className="font-semibold">
                    {latestContestResult.scored_points || 0}/{latestContestResult.total_points || 0}
                  </span>
                </p>
                <p>
                  Accuracy: <span className="font-semibold">{latestContestResult.score_pct || 0}%</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Complete a contest to see results here.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-dark">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Weekly Contest Plan</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {clusterLabel}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Next weekly contest: {nextWeeklyContestLabel}</p>
            {weeklySchedule ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Scheduled day index: {weeklySchedule.weekday}, time: {String(weeklySchedule.hour).padStart(2, "0")}:
                {String(weeklySchedule.minute).padStart(2, "0")}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Set your weekly contest schedule in the Personalized Contest page.
              </p>
            )}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-3">
          <section className="lg:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">pie_chart</span>
              <h3 className="text-lg font-bold">Topic Accuracy</h3>
            </div>
            <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-card-dark">
              {topicAccuracyRows.map((row) => (
                <div className="space-y-2" key={row.topic}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{row.topic}</span>
                    <span className="font-bold text-primary">{row.value}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${row.value}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              <h3 className="text-lg font-bold">Recent Submissions</h3>
            </div>
            <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-900/20">
              <span className="text-amber-700 dark:text-amber-300">Login to Codeforces to view submissions</span>
              <a
                className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500"
                href="https://codeforces.com/enter"
                rel="noreferrer"
                target="_blank"
              >
                Login to Codeforces
              </a>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-card-dark">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Problem Name</th>
                      <th className="px-4 py-3 font-semibold">Topic</th>
                      <th className="px-4 py-3 font-semibold">Verdict</th>
                      <th className="px-4 py-3 font-semibold text-center">View</th>
                      <th className="px-4 py-3 font-semibold text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentSubmissionRows.map((row) => (
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30" key={`${row.name}-${row.time}`}>
                        <td className="px-4 py-4 font-medium">{row.name}</td>
                        <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{row.topic}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${verdictStyles[row.tone]}`}
                          >
                            {row.verdict}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
                            disabled={!row.view_url}
                            onClick={() => openSubmissionInApp(row.view_url)}
                            type="button"
                          >
                            View
                          </button>
                        </td>
                        <td className="px-4 py-4 text-right text-slate-500">{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 z-20 flex w-full border-t border-slate-200 bg-white px-2 py-3 dark:border-slate-800 dark:bg-card-dark md:hidden">
        <a className="flex flex-1 flex-col items-center justify-center gap-1 text-primary" href="#">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[10px] font-bold">Dashboard</span>
        </a>
        <a className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400" href="#">
          <span className="material-symbols-outlined">description</span>
          <span className="text-[10px] font-medium">Sheet</span>
        </a>
        <button
          className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400"
          onClick={onOpenPersonalizedContest}
          type="button"
        >
          <span className="material-symbols-outlined">emoji_events</span>
          <span className="text-[10px] font-medium">Contest</span>
        </button>
	        <button
	          className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400"
	          onClick={onOpenUpcoming}
	          type="button"
        >
          <span className="material-symbols-outlined">calendar_month</span>
          <span className="text-[10px] font-medium">Upcoming</span>
        </button>
	      </nav>
      {submissionModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">Submission Source Code</h3>
              <button
                className="rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                onClick={() => setSubmissionModal({ open: false, loading: false, error: "", payload: null })}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 p-4">
              {submissionModal.loading ? <p className="text-sm text-slate-300">Loading source code...</p> : null}
              {submissionModal.error ? <p className="text-sm text-red-300">{submissionModal.error}</p> : null}
              {submissionModal.payload?.submission_url ? (
                <a
                  className="text-xs text-primary underline"
                  href={submissionModal.payload.submission_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open on Codeforces
                </a>
              ) : null}
              {submissionModal.payload?.language ? (
                <p className="text-xs text-slate-300">Language: {submissionModal.payload.language}</p>
              ) : null}
              {submissionModal.payload?.verdict ? (
                <p className="text-xs text-slate-300">Verdict: {submissionModal.payload.verdict}</p>
              ) : null}
              {submissionModal.payload?.code ? (
                <pre className="max-h-[60vh] overflow-auto rounded bg-black/40 p-3 text-xs text-slate-100">
                  <code>{submissionModal.payload.code}</code>
                </pre>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {confirmDialogNode}
	    </div>
	  );
}

function PersonalizedSheetPage({
  onGoDashboard,
  onOpenPersonalizedContest,
  onOpenUpcoming,
  authUser,
  cachedSheet,
  onSheetData,
}) {
  const [sheetData, setSheetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [availableTopics, setAvailableTopics] = useState([]);
  const [savingTopics, setSavingTopics] = useState(false);
  const [preferenceError, setPreferenceError] = useState("");
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editorModalProblem, setEditorModalProblem] = useState(null);
  const { askConfirm, confirmDialogNode } = useThemedConfirm();
  const cachedSheetCodeforcesId = cachedSheet?.codeforces_id || "";

  const fetchAvailableTopics = useCallback(async () => {
    try {
      const response = await fetch("/api/topics");
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) return;
      const topics = Array.isArray(data?.topics) ? data.topics.map((item) => item.value).filter(Boolean) : [];
      if (topics.length > 0) {
        setAvailableTopics(topics);
      }
    } catch {
      // Non-blocking: sheet endpoint also returns topics.
    }
  }, []);

  const fetchSheet = async (forceRefresh = false, topicsOverride = null, options = {}) => {
    const codeforcesId = authUser?.codeforces_id;
    if (!codeforcesId) return;
    const silent = Boolean(options?.silent);

    const selected = Array.isArray(topicsOverride) ? topicsOverride : selectedTopics;
    if (!silent) {
      setLoading(true);
      setSheetError("");
    }
    setPreferenceError("");
    try {
      const response = await fetch("/api/recommendations/weak-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codeforcesId,
          perTopic: 5,
          totalProblems: 5,
          selectedTopics: selected,
          forceRefresh,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.detail || `Unable to generate sheet (HTTP ${response.status})`);
      }

      setSheetData(data);
      setSelectedTopics(Array.isArray(data?.selected_topics) ? data.selected_topics : selected);
      setAvailableTopics(Array.isArray(data?.available_topics) ? data.available_topics : []);
      onSheetData?.(data);
    } catch (err) {
      if (!silent || !sheetData) {
        setSheetError(err?.message || "Failed to load personalized sheet");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAvailableTopics();
    if (cachedSheet && cachedSheet.codeforces_id === authUser?.codeforces_id) {
      setSheetData(cachedSheet);
      setSelectedTopics(Array.isArray(cachedSheet?.selected_topics) ? cachedSheet.selected_topics : []);
      setAvailableTopics(Array.isArray(cachedSheet?.available_topics) ? cachedSheet.available_topics : []);
      fetchSheet(false, cachedSheet?.selected_topics || [], { silent: true });
      return;
    }
    fetchSheet(false);
  }, [authUser?.codeforces_id, cachedSheetCodeforcesId, fetchAvailableTopics]);

  const topicProgressRows = Array.isArray(sheetData?.topic_progress) ? sheetData.topic_progress : [];
  const topicRecommendations = Array.isArray(sheetData?.recommendations) ? sheetData.recommendations : [];
  const suggestedProblems = topicRecommendations.flatMap((topic) => (Array.isArray(topic?.problems) ? topic.problems : []));
  const totalProblems = suggestedProblems.length;

  const toggleTopicSelection = (topic) => {
    setSelectedTopics((prev) => {
      if (prev.includes(topic)) {
        return prev.filter((item) => item !== topic);
      }
      return [...prev, topic];
    });
  };

  const saveTopicSelection = async () => {
    const codeforcesId = authUser?.codeforces_id;
    if (!codeforcesId) return;
    const shouldApply = await askConfirm({
      title: "Apply Topic Selection?",
      message: "Use selected topics for your personalized recommendations?",
      confirmLabel: "Apply Topics",
    });
    if (!shouldApply) {
      return;
    }
    const topicsToApply = Array.isArray(selectedTopics) ? selectedTopics.slice() : [];
    if (topicsToApply.length === 0) {
      setPreferenceError("Select at least one topic before applying.");
      return;
    }
    setSavingTopics(true);
    setPreferenceError("");
    try {
      const response = await fetch("/api/user/preferences/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeforcesId, topics: topicsToApply }),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || `Unable to save topics (HTTP ${response.status})`);
      }
      const normalized = Array.isArray(data?.selected_topics) ? data.selected_topics : topicsToApply;
      setSelectedTopics(normalized);
      await fetchSheet(true, normalized);
    } catch (err) {
      const msg = err?.message || "Failed to save preferred topics";
      // Fallback: even if DB save fails, still render recommendations for chosen topics now.
      try {
        await fetchSheet(true, topicsToApply);
        if (msg.toLowerCase().includes("user not found")) {
          setPreferenceError("Topics applied for this session, but profile preferences could not be saved. Please re-login.");
        } else {
          setPreferenceError(`Applied topics for this session only: ${msg}`);
        }
      } catch {
        if (msg.toLowerCase().includes("user not found")) {
          setPreferenceError("User not found in database. Please log out and log in again.");
        } else {
          setPreferenceError(msg);
        }
      }
    } finally {
      setSavingTopics(false);
    }
  };

  const openProblemEditor = (problem) => {
    if (!problem?.cf_link) return;
    setEditorModalProblem({
      ...problem,
      title: problem.problem_name || problem.title || problem.problem_key,
    });
    setEditorModalOpen(true);
  };

  const exportSheetAsPdf = () => {
    if (!sheetData || suggestedProblems.length === 0) return;

    const escapeHtml = (value) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const topicSummaryRows = topicProgressRows
      .map(
        (topic) => `
          <tr>
            <td>${escapeHtml(formatTopicLabel(topic.topic || ""))}</td>
            <td>${escapeHtml(topic.solved_unique || 0)}/${escapeHtml(topic.attempted_unique || 0)}</td>
            <td>${escapeHtml(Math.round(Number(topic.accuracy_unique || 0) * 100))}%</td>
            <td>${escapeHtml(topic.weakness_score || 0)}</td>
          </tr>
        `
      )
      .join("");

    const problemRows = suggestedProblems
      .map(
        (problem) => `
          <tr>
            <td>${escapeHtml(formatTopicLabel(problem.topic || ""))}</td>
            <td>${escapeHtml(problem.problem_name)}</td>
            <td>${escapeHtml(problem.problem_key)}</td>
            <td>${escapeHtml(problem.problem_rating || "-")}</td>
            <td><a href="${escapeHtml(problem.cf_link)}" target="_blank" rel="noreferrer">Open</a></td>
          </tr>
        `
      )
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Personalized Sheet - ${escapeHtml(sheetData.codeforces_id)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 8px; }
            .meta { color: #475569; margin-bottom: 20px; }
            section { margin-top: 20px; page-break-inside: avoid; }
            h2 { margin: 0 0 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f1f5f9; }
            a { color: #2563eb; text-decoration: none; }
          </style>
        </head>
        <body>
          <h1>CP Mentor Personalized Sheet</h1>
          <div class="meta">
            User: ${escapeHtml(sheetData.codeforces_id)} | Cluster: ${escapeHtml(sheetData.cluster)} | Topics: ${escapeHtml(
              selectedTopics.length
            )} | Problems: ${escapeHtml(totalProblems)}
          </div>
          <section>
            <h2>Selected Topics Progress</h2>
            <table>
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Solved / Attempted</th>
                  <th>Accuracy</th>
                  <th>Weakness</th>
                </tr>
              </thead>
              <tbody>
                ${topicSummaryRows}
              </tbody>
            </table>
          </section>
          <section>
            <h2>Suggested Problems</h2>
            <table>
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Problem</th>
                  <th>Key</th>
                  <th>Rating</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                ${problemRows}
              </tbody>
            </table>
          </section>
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open("", "sheet-pdf-export", "width=1100,height=800");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex flex-col md:pl-64">
      <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-card-dark md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined">terminal</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">CP Tracker</h1>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onGoDashboard}
            type="button"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-medium">Dashboard</span>
          </button>
          <a className="flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2 text-primary" href="#">
            <span className="material-symbols-outlined">description</span>
            <span className="font-medium">Personalized Sheet</span>
          </a>
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onOpenPersonalizedContest}
            type="button"
          >
            <span className="material-symbols-outlined">emoji_events</span>
            <span className="font-medium">Personalized Contest</span>
          </button>
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onOpenUpcoming}
            type="button"
          >
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="font-medium">Upcoming Contest</span>
          </button>
        </nav>

      </aside>

      <header className="sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
          <h1 className="text-xl font-bold tracking-tight">Personalized Sheet</h1>
          <div className="flex items-center gap-3">
            <button
              className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-60 transition-colors"
              title="Update Sheet"
              onClick={() => fetchSheet(true)}
              disabled={loading || !authUser?.codeforces_id}
            >
              <span className="material-symbols-outlined text-[22px]">update</span>
            </button>
            <button
              className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 disabled:opacity-60 transition-colors"
              disabled={loading || suggestedProblems.length === 0}
              onClick={exportSheetAsPdf}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              <span>Export</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full pb-8">
        <div className="bg-[#1c2433] rounded-xl p-5 border border-slate-800 shadow-sm mb-6">
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-slate-400 text-sm font-medium">Overall Progress</p>
              <h2 className="text-2xl font-bold mt-1">
                {totalProblems} <span className="text-sm font-normal text-slate-500">Suggested Problems</span>
              </h2>
            </div>
            <div className="text-right">
              <span className="text-primary font-bold">{sheetData?.cluster ?? "-"}</span>
            </div>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5">
            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${Math.min(totalProblems * 20, 100)}%` }}></div>
          </div>
        </div>

        {!authUser?.codeforces_id ? (
          <div className="bg-[#1c2433] rounded-xl border border-slate-800 p-4 text-sm text-slate-300">
            Log in with a Codeforces-linked account to generate your personalized sheet.
          </div>
        ) : null}

        <section className="bg-[#1c2433] rounded-xl border border-slate-800 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Topics You Want To Master</h3>
            <button
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-60"
              onClick={saveTopicSelection}
              type="button"
              disabled={savingTopics || loading}
            >
              {savingTopics ? "Saving..." : "Apply Topics"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(availableTopics || []).map((topic) => {
              const active = selectedTopics.includes(topic);
              return (
                <button
                  key={topic}
                  className={`px-2.5 py-1.5 rounded-full text-xs border transition-colors ${
                    active
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                  onClick={() => toggleTopicSelection(topic)}
                  type="button"
                >
                  {formatTopicLabel(topic)}
                </button>
              );
            })}
          </div>
          {preferenceError ? <p className="text-xs text-red-400">{preferenceError}</p> : null}
        </section>

        {loading ? (
          <div className="bg-[#1c2433] rounded-xl border border-slate-800 p-4 text-sm text-slate-300">Generating recommendations...</div>
        ) : null}
        {sheetError ? <div className="bg-[#1c2433] rounded-xl border border-red-800 p-4 text-sm text-red-300">{sheetError}</div> : null}

        <section className="bg-[#1c2433] rounded-xl border border-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Selected Topic Progress</h3>
          {topicProgressRows.length === 0 ? (
            <p className="text-sm text-slate-400">No topic progress available yet.</p>
          ) : (
            topicProgressRows.map((topicRow) => (
              <div key={topicRow.topic}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{topicRow.topic_label || formatTopicLabel(topicRow.topic)}</span>
                  <span>
                    {topicRow.solved_unique}/{topicRow.attempted_unique} solved
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-accent-rose"
                    style={{ width: `${Math.min(Math.max(Number(topicRow.weakness_score || 0) * 35, 8), 100)}%` }}
                  ></div>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold">Weak Topic Recommendations (5 Per Topic)</h3>
          {!loading && !sheetError && authUser?.codeforces_id && topicRecommendations.length === 0 ? (
            <div className="bg-[#1c2433] rounded-xl border border-slate-800 p-4 text-sm text-slate-300">
              No recommendations found for the selected topics.
            </div>
          ) : null}
          {topicRecommendations.map((topicEntry) => (
            <div key={topicEntry.topic} className="rounded-xl border border-slate-800 bg-[#1c2433] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-primary">
                    {formatTopicLabel(topicEntry.topic_label || topicEntry.topic)}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Weakness {topicEntry.weakness_score ?? 0} • Recommended attempted{" "}
                    {topicEntry.recommended_attempted_count ?? 0}/{topicEntry.recommended_count ?? 0}
                  </p>
                </div>
                <span className="text-[11px] text-slate-500">
                  Progress {topicEntry.recommended_progress_pct ?? 0}%
                </span>
              </div>
              {Array.isArray(topicEntry.problems) && topicEntry.problems.length > 0 ? (
                topicEntry.problems.map((problem) => {
                  const difficulty = difficultyFromRating(problem.problem_rating);
                  return (
                    <div className="rounded-lg border border-slate-700 p-3 flex items-center justify-between gap-4" key={`${topicEntry.topic}-${problem.problem_key}`}>
                      <div className="space-y-1">
                        <a className="text-sm font-medium hover:text-primary transition-colors" href={problem.cf_link} rel="noreferrer" target="_blank">
                          {problem.problem_name}
                        </a>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className={`px-2 py-0.5 rounded uppercase tracking-wide font-bold ${difficulty.cls}`}>{difficulty.label}</span>
                          <span>#{problem.problem_key}</span>
                          <span>Rating {problem.problem_rating || "-"}</span>
                          <span>Rank {problem.rank_in_topic || "-"}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {problem.status === "attempted" ? (
                          <span className="text-[11px] font-semibold text-amber-300">Attempted</span>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded bg-primary px-2 py-1 text-[10px] font-semibold text-white"
                            onClick={() => openProblemEditor(problem)}
                            type="button"
                          >
                            Solve In App
                          </button>
                          <a
                            className="rounded border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-slate-400"
                            href={problem.cf_link}
                            rel="noreferrer"
                            target="_blank"
                          >
                            CF
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-400">No problems found for this topic.</p>
              )}
            </div>
          ))}
        </section>
      </main>
      <ProblemEditorModal
        open={editorModalOpen}
        problem={editorModalProblem}
        onClose={() => setEditorModalOpen(false)}
      />
      {confirmDialogNode}
    </div>
  );
}

function PersonalizedContestPage({ onGoDashboard, onOpenPersonalizedSheet, onOpenUpcoming, authUser, onContestUpdated }) {
  const [contestProblems, setContestProblems] = useState([]);
  const [contestLoading, setContestLoading] = useState(false);
  const [contestError, setContestError] = useState("");
  const [contestStarted, setContestStarted] = useState(false);
  const [contestActive, setContestActive] = useState(false);
  const [contestEnded, setContestEnded] = useState(false);
  const [contestStartTime, setContestStartTime] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [endedElapsedSeconds, setEndedElapsedSeconds] = useState(0);
  const [weeklySchedule, setWeeklySchedule] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [completeSaving, setCompleteSaving] = useState(false);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editorModalProblem, setEditorModalProblem] = useState(null);
  const { askConfirm, confirmDialogNode } = useThemedConfirm();
  const [scheduleForm, setScheduleForm] = useState({ weekday: 1, hour: 20, minute: 0, contestDurationSeconds: 7200 });
  const [gateNowMs, setGateNowMs] = useState(() => Date.now());
  const [activeDurationSeconds, setActiveDurationSeconds] = useState(7200);
  const contestSubmittedRef = useRef(false);
  const autoScheduledRunRef = useRef(0);

  const configuredDurationSeconds = Number(
    weeklySchedule?.contest_duration_seconds || scheduleForm.contestDurationSeconds || 7200
  );
  const contestWindow = computeWeeklyContestWindow(weeklySchedule, configuredDurationSeconds, gateNowMs);
  const contestOpenNow = contestWindow.isOpenNow;
  const nextAllowedLabel = contestWindow.nextWindowStartMs
    ? new Date(contestWindow.nextWindowStartMs).toLocaleString()
    : "Not scheduled";

  const loadWeeklySchedule = useCallback(async () => {
    const codeforcesId = authUser?.codeforces_id;
    if (!codeforcesId) return;
    setScheduleLoading(true);
    setScheduleError("");
    try {
      const response = await fetch("/api/contest/weekly/schedule/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeforcesId }),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        if (response.status === 404) {
          setWeeklySchedule(null);
          return;
        }
        throw new Error(data?.detail || `Unable to load schedule (HTTP ${response.status})`);
      }
      const schedule = data?.weekly_contest_schedule || null;
      setWeeklySchedule(schedule);
      setGateNowMs(Date.now());
      if (schedule) {
        setScheduleForm({
          weekday: Number.isFinite(Number(schedule.weekday)) ? Number(schedule.weekday) : 1,
          hour: Number.isFinite(Number(schedule.hour)) ? Number(schedule.hour) : 20,
          minute: Number.isFinite(Number(schedule.minute)) ? Number(schedule.minute) : 0,
          contestDurationSeconds: Number.isFinite(Number(schedule.contest_duration_seconds))
            ? Number(schedule.contest_duration_seconds)
            : 7200,
        });
      }
    } catch (err) {
      setScheduleError(err?.message || "Failed to load weekly schedule");
    } finally {
      setScheduleLoading(false);
    }
  }, [authUser?.codeforces_id]);

  const saveWeeklySchedule = async () => {
    const codeforcesId = authUser?.codeforces_id;
    if (!codeforcesId) return;
    const shouldSave = await askConfirm({
      title: "Save Weekly Schedule?",
      message: "Save selected weekday, time and contest duration for weekly automated contest?",
      confirmLabel: "Save Schedule",
    });
    if (!shouldSave) {
      return;
    }
    setScheduleSaving(true);
    setScheduleError("");
    try {
      const response = await fetch("/api/contest/weekly/schedule/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codeforcesId,
          weekday: scheduleForm.weekday,
          hour: scheduleForm.hour,
          minute: scheduleForm.minute,
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
          contestDurationSeconds: scheduleForm.contestDurationSeconds,
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.detail || `Unable to save schedule (HTTP ${response.status})`);
      }
      setWeeklySchedule(data?.weekly_contest_schedule || null);
      setGateNowMs(Date.now());
    } catch (err) {
      setScheduleError(err?.message || "Failed to save weekly schedule");
    } finally {
      setScheduleSaving(false);
    }
  };

  const loadContestProblems = useCallback(async () => {
    const codeforcesId = authUser?.codeforces_id;
    if (!codeforcesId) {
      setContestError("Link a Codeforces ID to generate a personalized contest.");
      return [];
    }
    const liveWindow = computeWeeklyContestWindow(weeklySchedule, configuredDurationSeconds, Date.now());
    if (!liveWindow.hasSchedule) {
      setContestError("Set your weekly contest schedule first. Contest is locked until then.");
      return [];
    }
    if (!liveWindow.isOpenNow) {
      const lockLabel = liveWindow.nextWindowStartMs
        ? new Date(liveWindow.nextWindowStartMs).toLocaleString()
        : "your saved slot";
      setContestError(`Contest is locked. It will be available at ${lockLabel}.`);
      return [];
    }

    setContestLoading(true);
    setContestError("");
    try {
      const response = await fetch("/api/contest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codeforcesId,
          totalProblems: 4,
          perTopic: 10,
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.detail || `Unable to load contest (HTTP ${response.status})`);
      }

      const problems = (data?.problems || [])
        .slice(0, 4)
        .map((problem) => ({
          topic: problem.topic,
          title: problem.problem_name,
          problem_key: problem.problem_key,
          rating: problem.problem_rating,
          cf_link: problem.cf_link,
          status: "not_attempted",
        }))
        .filter((problem) => problem.problem_key && problem.cf_link);

      setContestProblems(problems);
      setContestStarted(false);
      setContestActive(false);
      setContestEnded(false);
      setContestStartTime(null);
      setRemainingSeconds(0);
      setEndedElapsedSeconds(0);
      contestSubmittedRef.current = false;
      if (problems.length < 4) {
        setContestError("Not enough recommended problems available to build a 4-problem contest.");
      }
      return problems;
    } catch (err) {
      setContestError(err?.message || "Failed to load contest problems");
      return [];
    } finally {
      setContestLoading(false);
    }
  }, [authUser?.codeforces_id, configuredDurationSeconds, weeklySchedule]);

  const refreshContestStatus = useCallback(async () => {
    const codeforcesId = authUser?.codeforces_id;
    if (!codeforcesId || contestProblems.length === 0) return;

    setRefreshLoading(true);
    try {
      const response = await fetch("/api/contest/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codeforcesId,
          problemKeys: contestProblems.map((problem) => problem.problem_key),
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.detail || `Unable to refresh status (HTTP ${response.status})`);
      }
      const solvedKeys = new Set(data?.solved_keys || []);
      setContestProblems((prev) =>
        prev.map((problem) =>
          solvedKeys.has(problem.problem_key) ? { ...problem, status: "solved" } : problem
        )
      );
    } catch {
      // Keep previous status on failure.
    } finally {
      setRefreshLoading(false);
    }
  }, [authUser?.codeforces_id, contestProblems]);

  const submitContestResult = useCallback(async (elapsedSeconds) => {
    const codeforcesId = authUser?.codeforces_id;
    if (!codeforcesId || contestProblems.length === 0) return;
    setCompleteSaving(true);
    try {
      const response = await fetch("/api/contest/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codeforcesId,
          durationSeconds: elapsedSeconds,
          startedAt: contestStartTime ? Math.floor(contestStartTime / 1000) : undefined,
          finishedAt: Math.floor(Date.now() / 1000),
          problems: contestProblems.map((problem) => ({
            problemKey: problem.problem_key,
            topic: problem.topic,
            rating: problem.rating,
            status: problem.status,
          })),
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.detail || `Unable to save contest result (HTTP ${response.status})`);
      }
      onContestUpdated?.(codeforcesId);
    } catch (err) {
      setContestError(err?.message || "Failed to save contest result");
    } finally {
      setCompleteSaving(false);
    }
  }, [authUser?.codeforces_id, contestProblems, contestStartTime, onContestUpdated]);

  const finalizeContest = useCallback((elapsedSeconds) => {
    setEndedElapsedSeconds(elapsedSeconds);
    setContestActive(false);
    setContestEnded(true);
    if (!contestSubmittedRef.current) {
      contestSubmittedRef.current = true;
      submitContestResult(elapsedSeconds);
    }
  }, [submitContestResult]);

  useEffect(() => {
    loadWeeklySchedule();
  }, [loadWeeklySchedule]);

  useEffect(() => {
    const timer = setInterval(() => setGateNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!contestActive || !contestStartTime) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - contestStartTime) / 1000);
      const nextRemaining = Math.max(0, activeDurationSeconds - elapsed);
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0) {
        finalizeContest(activeDurationSeconds);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeDurationSeconds, contestActive, contestStartTime, finalizeContest]);

  useEffect(() => {
    if (!contestActive) return;
    const timer = setInterval(() => {
      refreshContestStatus();
    }, 20000);
    return () => clearInterval(timer);
  }, [contestActive, refreshContestStatus]);

  const startContestSession = useCallback((problemsOverride = null) => {
    const baseProblems = Array.isArray(problemsOverride) ? problemsOverride : contestProblems;
    if (!contestOpenNow || contestActive || baseProblems.length === 0) return;
    const resetProblems = baseProblems.map((problem) => ({ ...problem, status: "not_attempted" }));
    setContestProblems(resetProblems);
    contestSubmittedRef.current = false;
    setContestStarted(true);
    setContestActive(true);
    setContestEnded(false);
    setEndedElapsedSeconds(0);
    const start = Date.now();
    setActiveDurationSeconds(configuredDurationSeconds);
    setContestStartTime(start);
    setRemainingSeconds(configuredDurationSeconds);
  }, [configuredDurationSeconds, contestActive, contestOpenNow, contestProblems]);

  const handleStartContest = async () => {
    if (!contestWindow.hasSchedule) {
      setContestError("Set your weekly contest schedule first. Contest is locked until then.");
      return;
    }
    if (!contestOpenNow) {
      setContestError(`Contest is locked. It will be available at ${nextAllowedLabel}.`);
      return;
    }
    if (contestProblems.length === 0) {
      const shouldStart = await askConfirm({
        title: "Start Contest?",
        message: "Contest timer will begin immediately.",
        confirmLabel: "Start Contest",
      });
      if (!shouldStart) {
        return;
      }
      const generated = await loadContestProblems();
      if (generated.length === 0) return;
      startContestSession(generated);
      return;
    }
    const shouldStart = await askConfirm({
      title: "Start Contest?",
      message: "Contest timer will begin immediately.",
      confirmLabel: "Start Contest",
    });
    if (!shouldStart) {
      return;
    }
    startContestSession();
  };

  const handleEndContest = async () => {
    const shouldEnd = await askConfirm({
      title: "End Contest?",
      message: "Timer will stop and contest summary will be generated.",
      confirmLabel: "End Contest",
      danger: true,
    });
    if (!shouldEnd) {
      return;
    }
    const elapsed = contestStartTime ? Math.min(activeDurationSeconds, Math.max(0, Math.floor((Date.now() - contestStartTime) / 1000))) : 0;
    finalizeContest(elapsed);
  };

  const handleGenerateNextContestSet = async () => {
    const shouldGenerate = await askConfirm({
      title: "Generate New Contest Set?",
      message: "Current contest problems will be replaced with a new set.",
      confirmLabel: "Generate",
      danger: true,
    });
    if (!shouldGenerate) {
      return;
    }
    await loadContestProblems();
  };

  const openProblemEditor = (problem) => {
    if (!problem?.cf_link) return;
    setEditorModalProblem({
      ...problem,
      title: problem.title || problem.problem_name || problem.problem_key,
      topic: problem.topic,
    });
    setEditorModalOpen(true);
  };

  useEffect(() => {
    if (!contestWindow.isOpenNow || !contestWindow.windowStartMs || contestActive || contestStarted) {
      return;
    }

    let cancelled = false;
    const autoStartCurrentWindow = async () => {
      if (cancelled) return;
      if (autoScheduledRunRef.current === contestWindow.windowStartMs) return;
      autoScheduledRunRef.current = contestWindow.windowStartMs;
      const generatedProblems = await loadContestProblems();
      if (cancelled) return;
      if (generatedProblems.length === 0) return;
      startContestSession(generatedProblems);
      loadWeeklySchedule();
    };

    autoStartCurrentWindow();
    return () => {
      cancelled = true;
    };
  }, [
    contestActive,
    contestStarted,
    contestWindow.isOpenNow,
    contestWindow.windowStartMs,
    loadContestProblems,
    loadWeeklySchedule,
    startContestSession,
  ]);

  const solvedCount = contestProblems.filter((problem) => problem.status === "solved").length;
  const totalPoints = contestProblems.reduce((sum, problem) => sum + (Number(problem.rating) || 0), 0);
  const scoredPoints = contestProblems.reduce(
    (sum, problem) => sum + (problem.status === "solved" ? Number(problem.rating) || 0 : 0),
    0
  );
  const progressPct = contestProblems.length
    ? Math.round((solvedCount / contestProblems.length) * 100)
    : 0;
  const scheduledLabel = nextAllowedLabel;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col font-display md:pl-64">
      <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-card-dark md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined">terminal</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">CP Tracker</h1>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onGoDashboard}
            type="button"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-medium">Dashboard</span>
          </button>
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onOpenPersonalizedSheet}
            type="button"
          >
            <span className="material-symbols-outlined">description</span>
            <span className="font-medium">Personalized Sheet</span>
          </button>
          <a className="flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2 text-primary" href="#">
            <span className="material-symbols-outlined">emoji_events</span>
            <span className="font-medium">Personalized Contest</span>
          </a>
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onOpenUpcoming}
            type="button"
          >
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="font-medium">Upcoming Contest</span>
          </button>
        </nav>
      </aside>

      <header className="sticky top-0 z-30 bg-background-dark/80 backdrop-blur-md px-4 pt-4 pb-2 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">trophy</span>
            <h1 className="text-xl font-bold tracking-tight">Personalized Contest</h1>
          </div>
          <button
            className="p-2 hover:bg-slate-800 rounded-full transition-colors disabled:opacity-60"
            onClick={refreshContestStatus}
            type="button"
            disabled={refreshLoading || contestProblems.length === 0}
          >
            <span className="material-symbols-outlined text-slate-400">sync</span>
          </button>
        </div>
        <div className="flex gap-3 pb-2">
          <button
            className="flex-1 bg-gradient-to-r from-primary to-[#6366f1] text-white py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-60"
            onClick={handleStartContest}
            type="button"
            disabled={contestActive || contestLoading || !contestOpenNow}
          >
            <span className="material-symbols-outlined text-sm">play_arrow</span>
            {contestOpenNow ? "Start Contest" : "Contest Locked"}
          </button>
          <button
            className={`flex-1 border py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 ${
              contestActive ? "border-red-500/60 text-red-500" : "border-red-500/30 text-red-500/40 cursor-not-allowed"
            }`}
            onClick={handleEndContest}
            type="button"
            disabled={!contestActive}
          >
            <span className="material-symbols-outlined text-sm">stop</span>
            End Contest
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-32">
        <section className="contest-glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Weekly Automated Contest Schedule</h3>
            <span className="text-[11px] text-slate-400">Next: {scheduledLabel}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="text-xs text-slate-400">
              Weekday
              <select
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm"
                value={scheduleForm.weekday}
                onChange={(e) => setScheduleForm((prev) => ({ ...prev, weekday: Number(e.target.value) }))}
              >
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((label, idx) => (
                  <option key={label} value={idx}>{label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Hour
              <input
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm"
                type="number"
                min={0}
                max={23}
                value={scheduleForm.hour}
                onChange={(e) => setScheduleForm((prev) => ({ ...prev, hour: Number(e.target.value) }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Minute
              <input
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm"
                type="number"
                min={0}
                max={59}
                value={scheduleForm.minute}
                onChange={(e) => setScheduleForm((prev) => ({ ...prev, minute: Number(e.target.value) }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Duration
              <select
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm"
                value={scheduleForm.contestDurationSeconds}
                onChange={(e) =>
                  setScheduleForm((prev) => ({ ...prev, contestDurationSeconds: Number(e.target.value) }))
                }
              >
                <option value={10800}>3 Hours (Beginner)</option>
                <option value={7200}>2 Hours (Intermediate)</option>
                <option value={3600}>1 Hour (Master)</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 rounded bg-primary text-white text-xs font-semibold disabled:opacity-60"
              onClick={saveWeeklySchedule}
              type="button"
              disabled={scheduleSaving || scheduleLoading}
            >
              {scheduleSaving ? "Saving..." : "Save Weekly Schedule"}
            </button>
            <button
              className="px-3 py-1.5 rounded border border-slate-600 text-slate-200 text-xs font-semibold disabled:opacity-60"
              onClick={loadWeeklySchedule}
              type="button"
              disabled={scheduleLoading}
            >
              {scheduleLoading ? "Refreshing..." : "Refresh Schedule"}
            </button>
          </div>
          {!contestWindow.hasSchedule ? (
            <p className="text-xs text-amber-300">
              Set your weekly schedule to unlock contest availability.
            </p>
          ) : !contestOpenNow ? (
            <p className="text-xs text-amber-300">
              Contest is locked outside scheduled time. Next window opens at {nextAllowedLabel}.
            </p>
          ) : (
            <p className="text-xs text-emerald-300">
              Contest is currently available until {new Date(contestWindow.windowEndMs).toLocaleString()}.
            </p>
          )}
          {scheduleError ? <p className="text-xs text-red-400">{scheduleError}</p> : null}
          {completeSaving ? <p className="text-xs text-slate-400">Saving contest result and refreshing cluster...</p> : null}
        </section>

        {contestEnded && contestStarted ? (
          <section className="contest-glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Contest Summary</h3>
              <span className="text-xs text-slate-400 font-medium">
                {scoredPoints}/{totalPoints} Points
              </span>
            </div>
            <div className="text-xs text-slate-400">Time Taken: {formatCountdown(endedElapsedSeconds)}</div>
            <div className="space-y-3">
              {contestProblems.map((problem) => (
                <div className="flex items-center justify-between text-sm" key={problem.problem_key}>
                  <div>
                    <a
                      className="font-medium text-white hover:text-primary transition-colors"
                      href={problem.cf_link}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {problem.title}
                    </a>
                    <p className="text-[10px] text-slate-400">{formatTopicLabel(problem.topic)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{problem.rating || 0} pts</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                        problem.status === "solved" ? "status-solved" : "status-none"
                      }`}
                    >
                      {problem.status === "solved" ? "Solved" : "Unsolved"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <button
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                onClick={handleGenerateNextContestSet}
                type="button"
                disabled={contestLoading || !contestOpenNow}
              >
                {contestLoading ? "Preparing..." : "Generate Next Contest Set"}
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-purple-500/30 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative contest-glass-card rounded-xl p-6 flex flex-col items-center justify-center text-center overflow-hidden">
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  {contestActive ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                      <span className="text-[10px] font-bold text-red-500 tracking-widest uppercase">Live</span>
                    </>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                      {contestEnded ? "Ended" : "Idle"}
                    </span>
                  )}
                </div>
                <h2 className="text-4xl md:text-5xl font-mono font-extrabold tracking-widest text-white drop-shadow-sm">
                  {contestStarted ? formatCountdown(remainingSeconds) : "00:00:00"}
                </h2>
                <p className="text-slate-400 text-sm mt-2 font-medium">Contest Time Remaining</p>
                <div className="mt-4 w-full bg-slate-800/50 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full"
                    style={{
                      width: `${contestStarted ? Math.max(0, Math.min(100, (remainingSeconds / Math.max(1, activeDurationSeconds)) * 100)) : 0}%`,
                      boxShadow: "0 0 8px #256af4",
                    }}
                  ></div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Problems</h3>
                <span className="text-xs text-slate-500 font-medium">{contestProblems.length} Total</span>
              </div>

              {contestLoading ? (
                <div className="contest-glass-card rounded-xl p-4 text-sm text-slate-400">Loading contest problems...</div>
              ) : null}
              {contestError ? (
                <div className="contest-glass-card rounded-xl p-4 text-sm text-red-400">{contestError}</div>
              ) : null}
              {!contestStarted && !contestLoading && !contestError ? (
                <div className="contest-glass-card rounded-xl p-6 text-center text-sm text-slate-400">
                  {contestOpenNow
                    ? "Start the contest to reveal your four weakest-topic problems."
                    : `Contest is locked. It opens at ${nextAllowedLabel}.`}
                </div>
              ) : null}

              {contestStarted
                ? contestProblems.map((problem, idx) => {
                    const difficulty = difficultyFromRating(problem.rating);
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <div className="contest-glass-card rounded-xl p-4 transition-all active:scale-[0.98]" key={problem.problem_key}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-primary font-bold">
                              {letter}
                            </div>
                            <div>
                              <h4 className="font-bold text-white">{problem.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${difficulty.cls}`}>
                                  {difficulty.label}
                                </span>
                                <span className="text-[10px] text-slate-400">- {formatTopicLabel(problem.topic)}</span>
                              </div>
                            </div>
                          </div>
                          {problem.status === "solved" ? (
                            <span className="status-solved text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">check_circle</span> Solved
                            </span>
                          ) : (
                            <span className="status-none text-[10px] font-bold px-2 py-1 rounded-full">Not Attempted</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <span className="text-xs font-semibold text-slate-400 tracking-wider">{problem.rating || "-"} PTS</span>
                          <div className="flex items-center gap-2">
                            <button
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                                contestEnded ? "bg-slate-700 text-slate-400 cursor-not-allowed" : "bg-primary text-white"
                              }`}
                              onClick={() => openProblemEditor(problem)}
                              type="button"
                              disabled={contestEnded}
                            >
                              Solve In App
                            </button>
                            <a
                              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                                contestEnded
                                  ? "border-slate-700 text-slate-500 cursor-not-allowed"
                                  : "border-slate-500 text-slate-200 hover:border-slate-300"
                              }`}
                              href={contestEnded ? "#" : problem.cf_link}
                              rel="noreferrer"
                              target={contestEnded ? undefined : "_blank"}
                              aria-disabled={contestEnded}
                            >
                              Open CF
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })
                : null}
            </section>
          </>
        )}
      </main>
      <ProblemEditorModal
        open={editorModalOpen}
        problem={editorModalProblem}
        onClose={() => setEditorModalOpen(false)}
      />
      {confirmDialogNode}

      <div className="fixed bottom-0 left-0 right-0 z-40 md:left-64">
        <div className="bg-background-dark/95 border-t border-slate-800 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white">{solvedCount}/{contestProblems.length} Solved</span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1 italic">
              {contestActive
                ? "Contest live"
                : contestEnded
                  ? "Contest ended"
                  : contestOpenNow
                    ? "Ready when you are"
                    : "Locked until scheduled time"}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
          </div>
        </div>
        <nav className="flex justify-between bg-slate-900 border-t border-slate-800 px-6 py-3 md:hidden">
          <button className="flex flex-col items-center gap-1 text-slate-500" onClick={onGoDashboard} type="button">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-[10px] font-medium">Dashboard</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-500" onClick={onOpenPersonalizedSheet} type="button">
            <span className="material-symbols-outlined">list_alt</span>
            <span className="text-[10px] font-medium">Sheet</span>
          </button>
          <a className="flex flex-col items-center gap-1 text-primary" href="#">
            <span className="material-symbols-outlined filled-icon">trophy</span>
            <span className="text-[10px] font-bold">Contest</span>
          </a>
          <button className="flex flex-col items-center gap-1 text-slate-500" onClick={onOpenUpcoming} type="button">
            <span className="material-symbols-outlined">event_note</span>
            <span className="text-[10px] font-medium">Upcoming</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

function UpcomingContestsPage({ onGoDashboard, onOpenPersonalizedSheet, onOpenPersonalizedContest, authUser }) {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [lastUpdated, setLastUpdated] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState("");

  const loadUpcomingContests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/contests/upcoming");
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.detail || `Unable to load contests (HTTP ${response.status})`);
      }
      const list = Array.isArray(data?.data) ? data.data : [];
      setContests(list);
      setLastUpdated(data?.last_updated || "");
    } catch (err) {
      setError(err?.message || "Failed to load upcoming contests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUpcomingContests();
  }, [loadUpcomingContests]);

  const contestDates = new Set(
    contests
      .map((contest) => new Date(contest.start_time))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => dateKey(date))
  );
  const calendarDays = buildCalendarDays(calendarMonth, contestDates);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(calendarMonth);
  const filteredContests = selectedDateKey
    ? contests.filter((contest) => {
        const date = new Date(contest.start_time);
        return !Number.isNaN(date.getTime()) && dateKey(date) === selectedDateKey;
      })
    : contests;
  const listLabel = selectedDateKey
    ? `${filteredContests.length} Contest${filteredContests.length === 1 ? "" : "s"} on ${selectedDateKey}`
    : `${contests.length} Contest${contests.length === 1 ? "" : "s"} Found`;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col md:pl-64">
      <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-card-dark md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined">terminal</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">CP Tracker</h1>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onGoDashboard}
            type="button"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-medium">Dashboard</span>
          </button>
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onOpenPersonalizedSheet}
            type="button"
          >
            <span className="material-symbols-outlined">description</span>
            <span className="font-medium">Personalized Sheet</span>
          </button>
          <button
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={onOpenPersonalizedContest}
            type="button"
          >
            <span className="material-symbols-outlined">emoji_events</span>
            <span className="font-medium">Personalized Contest</span>
          </button>
          <a className="flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2 text-primary" href="#">
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="font-medium">Upcoming Contest</span>
          </a>
        </nav>

      </aside>

      <header className="p-4 pt-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upcoming Contests</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Stay updated with future CP rounds
            {lastUpdated ? <span className="ml-2 text-xs text-slate-400">Updated {formatLocalDateTime(lastUpdated)}</span> : null}
          </p>
        </div>
        <button
          className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
          onClick={loadUpcomingContests}
          type="button"
          disabled={loading}
        >
          <span className="material-symbols-outlined">sync</span>
        </button>
      </header>

      <section className="px-4 mb-6">
        <div className="bg-white dark:bg-[#161b22] rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base">{monthLabel}</h2>
            <div className="flex gap-2">
              <button
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                onClick={() =>
                  setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                type="button"
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <button
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                onClick={() =>
                  setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                type="button"
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-medium text-slate-400 mb-2">
            <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {calendarDays.map((day) => (
              <button
                key={day.key}
                className={[
                  "relative h-9 flex items-center justify-center text-sm transition-colors",
                  day.inMonth ? "text-slate-900 dark:text-slate-100" : "text-slate-300 dark:text-slate-700",
                  day.isToday ? "bg-primary/20 rounded-lg text-primary font-bold border border-primary/30" : "",
                  selectedDateKey === day.key ? "ring-2 ring-primary/50 rounded-lg" : "",
                ].join(" ")}
                onClick={() => setSelectedDateKey(day.key)}
                type="button"
              >
                {day.date.getDate()}
                {day.hasContest ? (
                  <span className="absolute bottom-1 w-1 h-1 bg-primary rounded-full active-dot"></span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="flex-1 px-4 pb-24 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Upcoming List</h2>
          <span className="text-xs bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-500 font-medium">
            {listLabel}
          </span>
        </div>
        {selectedDateKey ? (
          <button
            className="mb-3 text-xs font-semibold text-primary hover:underline"
            onClick={() => setSelectedDateKey("")}
            type="button"
          >
            Clear date filter
          </button>
        ) : null}
        {error ? (
          <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-red-400">
            {error}
          </div>
        ) : null}
        {loading && contests.length === 0 ? (
          <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-500">
            Loading upcoming contests...
          </div>
        ) : null}
        {!loading && contests.length === 0 && !error ? (
          <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-500">
            No upcoming contests found for Codeforces or LeetCode.
          </div>
        ) : null}
        {!loading && contests.length > 0 && filteredContests.length === 0 && selectedDateKey ? (
          <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-500">
            No contests found on {selectedDateKey}.
          </div>
        ) : null}
        <div className="space-y-4">
          {filteredContests.map((contest) => {
            const style = platformStyles[contest.platform] || platformStyles.Codeforces;
            const contestLink = contest.register_url || contest.registration_url || contest.url || "#";
            return (
              <div
                className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm"
                key={`${contest.platform}-${contest.id || contest.title}-${contest.start_time}`}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${style.badge}`}>
                        {contest.platform}
                      </span>
                      {contest.phase ? <span className="text-xs text-slate-500">{contest.phase}</span> : null}
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${style.accent}`}>{formatTimeUntil(contest.start_time)}</p>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold leading-tight mb-3">{contest.title}</h3>
                  <div className="grid grid-cols-2 gap-4 text-slate-500 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">calendar_today</span>
                      <span>{formatLocalDateTime(contest.start_time)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">schedule</span>
                      <span>{formatDuration(contest.duration_seconds)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      className="flex-1 bg-gradient-to-r from-primary to-accent-purple text-white py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-transform text-center"
                      href={contestLink}
                      rel="noreferrer"
                      target={contestLink && contestLink !== "#" ? "_blank" : undefined}
                    >
                      View
                    </a>
                    <a
                      className="px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center"
                      href={contestLink}
                      rel="noreferrer"
                      target={contestLink && contestLink !== "#" ? "_blank" : undefined}
                      aria-label="Open contest register page"
                    >
                      <span className="material-symbols-outlined text-xl">calendar_add_on</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function App() {
  const [authUser, setAuthUser] = useState(() => loadStoredAuthUser());
  const [page, setPage] = useState(() => (loadStoredAuthUser() ? "dashboard" : "signup"));
  const [sheetCacheByUser, setSheetCacheByUser] = useState({});
  const [dashboardCacheByUser, setDashboardCacheByUser] = useState({});

  const handleLogout = useCallback(() => {
    setAuthUser(null);
    setSheetCacheByUser({});
    setDashboardCacheByUser({});
    setPage("login");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!authUser) {
        window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(authUser));
    } catch {
      // Storage failures should not break auth flow.
    }
  }, [authUser]);

  if (page === "dashboard") {
    const dashboardCacheKey = authUser?.codeforces_id || "";
    return (
      <DashboardPage
        authUser={authUser}
        cachedDashboard={dashboardCacheKey ? dashboardCacheByUser[dashboardCacheKey] : null}
        onLogout={handleLogout}
        onDashboardData={(data) => {
          const key = data?.codeforces_id || dashboardCacheKey;
          if (!key) return;
          setDashboardCacheByUser((prev) => ({ ...prev, [key]: data }));
        }}
        onOpenPersonalizedContest={() => setPage("personalized-contest")}
        onOpenPersonalizedSheet={() => setPage("personalized-sheet")}
        onOpenUpcoming={() => setPage("upcoming-contest")}
      />
    );
  }

  if (page === "personalized-sheet") {
    const cacheKey = authUser?.codeforces_id || "";
    return (
      <PersonalizedSheetPage
        authUser={authUser}
        cachedSheet={cacheKey ? sheetCacheByUser[cacheKey] : null}
        onSheetData={(sheet) => {
          const key = sheet?.codeforces_id || cacheKey;
          if (!key) return;
          setSheetCacheByUser((prev) => ({ ...prev, [key]: sheet }));
        }}
        onGoDashboard={() => setPage("dashboard")}
        onOpenPersonalizedContest={() => setPage("personalized-contest")}
        onOpenUpcoming={() => setPage("upcoming-contest")}
      />
    );
  }

  if (page === "personalized-contest") {
    return (
      <PersonalizedContestPage
        authUser={authUser}
        onContestUpdated={(codeforcesId) => {
          if (!codeforcesId) return;
          setSheetCacheByUser((prev) => {
            if (!(codeforcesId in prev)) return prev;
            const next = { ...prev };
            delete next[codeforcesId];
            return next;
          });
          setDashboardCacheByUser((prev) => {
            if (!(codeforcesId in prev)) return prev;
            const next = { ...prev };
            delete next[codeforcesId];
            return next;
          });
        }}
        onGoDashboard={() => setPage("dashboard")}
        onOpenPersonalizedSheet={() => setPage("personalized-sheet")}
        onOpenUpcoming={() => setPage("upcoming-contest")}
      />
    );
  }

  if (page === "upcoming-contest") {
    return (
      <UpcomingContestsPage
        authUser={authUser}
        onGoDashboard={() => setPage("dashboard")}
        onOpenPersonalizedContest={() => setPage("personalized-contest")}
        onOpenPersonalizedSheet={() => setPage("personalized-sheet")}
      />
    );
  }

  return page === "signup" ? (
    <SignUpPage
      onAuthSuccess={(user) => {
        if (!user) return;
        setAuthUser(user);
        setPage("dashboard");
      }}
      onGoToLogin={() => setPage("login")}
    />
  ) : (
    <LoginPage
      onAuthSuccess={(user) => {
        if (!user) return;
        setAuthUser(user);
        setPage("dashboard");
      }}
      onGoToSignup={() => setPage("signup")}
    />
  );
}

export default App;
