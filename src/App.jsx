import { useState } from "react";

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

function SignUpPage({ onGoToLogin, onAuthSuccess }) {
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
            onSubmit={(e) => {
              e.preventDefault();
              onAuthSuccess();
            }}
          >
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
                  placeholder="••••••••"
                  type="password"
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
                />
              </div>
              <p className="text-[11px] text-primary/80 flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-[14px]">info</span>
                We&apos;ll use this to sync your contest data.
              </p>
            </div>

            <button
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3.5 rounded-lg shadow-[0_0_20px_rgba(37,106,244,0.3)] transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
              type="submit"
            >
              <span>Sign Up</span>
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
            onSubmit={(e) => {
              e.preventDefault();
              onAuthSuccess();
            }}
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
                  placeholder="••••••••"
                  type="password"
                />
                <button
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">visibility</span>
                </button>
              </div>
            </div>

            <button
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] mt-2"
              type="submit"
            >
              Log In
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

function DashboardPage({ onOpenPersonalizedSheet, onOpenPersonalizedContest, onOpenUpcoming }) {
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
          <a
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            href="#"
          >
            <span className="material-symbols-outlined">public</span>
            <span className="font-medium">Global Contest</span>
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

        <div className="mt-auto rounded-xl bg-slate-100 p-4 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAq887wRBDbiCSDU6K95-YpV9iKeikbvwxJ-b0eW5bVgf2YrA-dgR9dt1hLIAZ_UMhBPBdnzSTGHBHOQRhHKmK8dlvyIIZw5zGfvuwW02yUZJU5F_kU8diZLDEgb4dblcgSVFE9Hyi4uib3Tcb79kkntBzVXXfBNyqrhmtVsV1TYTo6YStgPCO02gFSxXdV4s2RqaZp0st-Bxy9PttyCTbJ4ebDXMjmOJFyb26cmVBHwm98VKRdyMO1Jt2dUkfBpchC32T0OErsXjI')",
              }}
            ></div>
            <div>
              <p className="text-sm font-bold">tourist_fan</p>
              <p className="text-xs text-slate-500">Expert</p>
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-background-dark/80 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined text-lg">terminal</span>
          </div>
          <span className="font-bold">CP Tracker</span>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <span className="material-symbols-outlined">sync</span>
        </button>
      </header>

      <main className="mx-auto max-w-6xl p-4 md:p-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">
              Welcome back, <span className="text-accent-purple">tourist_fan</span>
            </h2>
            <p className="mt-1 text-slate-500 dark:text-slate-400">Last synced: 2 minutes ago</p>
          </div>
          <button className="hidden items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 md:flex">
            <span className="material-symbols-outlined text-sm">sync</span>
            Sync Profile
          </button>
        </div>

        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            <h3 className="text-lg font-bold">Codeforces Stats</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-dark">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Current Rating</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-accent-purple">1924</span>
                <span className="text-xs font-semibold text-green-500">+42</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-accent-purple" style={{ width: "72%" }}></div>
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-dark">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Max Rating</span>
              <span className="text-3xl font-bold">2150</span>
              <span className="text-xs text-slate-400">Master peak</span>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-dark">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Global Rank</span>
              <span className="text-3xl font-bold text-primary">#1,402</span>
              <span className="text-xs text-slate-400">Top 2.5%</span>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card-dark">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Problems Solved</span>
              <span className="text-3xl font-bold">1,240</span>
              <span className="text-xs text-slate-400">Across 8 platforms</span>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-3">
          <section className="lg:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">pie_chart</span>
              <h3 className="text-lg font-bold">Topic Accuracy</h3>
            </div>
            <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-card-dark">
              {topicAccuracy.map((row) => (
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
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-card-dark">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Problem Name</th>
                      <th className="px-4 py-3 font-semibold">Topic</th>
                      <th className="px-4 py-3 font-semibold">Verdict</th>
                      <th className="px-4 py-3 font-semibold text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentSubmissions.map((row) => (
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
        <a className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400" href="#">
          <span className="material-symbols-outlined">public</span>
          <span className="text-[10px] font-medium">Global</span>
        </a>
        <button
          className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400"
          onClick={onOpenUpcoming}
          type="button"
        >
          <span className="material-symbols-outlined">calendar_month</span>
          <span className="text-[10px] font-medium">Upcoming</span>
        </button>
      </nav>
    </div>
  );
}

function PersonalizedSheetPage({ onGoDashboard, onOpenPersonalizedContest, onOpenUpcoming }) {
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
          <a
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            href="#"
          >
            <span className="material-symbols-outlined">public</span>
            <span className="font-medium">Global Contest</span>
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

        <div className="mt-auto rounded-xl bg-slate-100 p-4 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAq887wRBDbiCSDU6K95-YpV9iKeikbvwxJ-b0eW5bVgf2YrA-dgR9dt1hLIAZ_UMhBPBdnzSTGHBHOQRhHKmK8dlvyIIZw5zGfvuwW02yUZJU5F_kU8diZLDEgb4dblcgSVFE9Hyi4uib3Tcb79kkntBzVXXfBNyqrhmtVsV1TYTo6YStgPCO02gFSxXdV4s2RqaZp0st-Bxy9PttyCTbJ4ebDXMjmOJFyb26cmVBHwm98VKRdyMO1Jt2dUkfBpchC32T0OErsXjI')",
              }}
            ></div>
            <div>
              <p className="text-sm font-bold">tourist_fan</p>
              <p className="text-xs text-slate-500">Expert</p>
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
          <h1 className="text-xl font-bold tracking-tight">Personalized Sheet</h1>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Sync Sheet">
              <span className="material-symbols-outlined text-[22px]">sync</span>
            </button>
            <button
              className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              title="Update Sheet"
            >
              <span className="material-symbols-outlined text-[22px]">update</span>
            </button>
            <button className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-colors">
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
                12 / 25 <span className="text-sm font-normal text-slate-500">Problems</span>
              </h2>
            </div>
            <div className="text-right">
              <span className="text-primary font-bold">48%</span>
            </div>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5">
            <div className="bg-primary h-2.5 rounded-full" style={{ width: "48%" }}></div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#1c2433] rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 flex items-center justify-between cursor-pointer">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary">psychology</span>
                  <h3 className="font-bold text-lg">Dynamic Programming</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-800 h-1.5 rounded-full max-w-[120px]">
                    <div className="bg-accent-emerald h-1.5 rounded-full" style={{ width: "60%" }}></div>
                  </div>
                  <span className="text-xs font-medium text-slate-400">3/5 Completed</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500">expand_less</span>
            </div>

            <div className="border-t border-slate-800 bg-background-dark/40">
              <div className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-slate-800/50">
                <div className="flex flex-col gap-1">
                  <a className="text-sm font-medium hover:text-primary transition-colors" href="#">
                    Climbing Stairs
                  </a>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20">
                      Easy
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-accent-emerald filled-icon">check_circle</span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-slate-800/50">
                <div className="flex flex-col gap-1">
                  <a className="text-sm font-medium hover:text-primary transition-colors" href="#">
                    Longest Palindromic Subsequence
                  </a>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
                      Medium
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-accent-emerald filled-icon">check_circle</span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-slate-800/50">
                <div className="flex flex-col gap-1">
                  <a className="text-sm font-medium hover:text-primary transition-colors" href="#">
                    Edit Distance
                  </a>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent-rose/10 text-accent-rose border border-accent-rose/20">
                      Hard
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-600">hourglass_empty</span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-slate-800/50">
                <div className="flex flex-col gap-1">
                  <a className="text-sm font-medium hover:text-primary transition-colors" href="#">
                    Coin Change II
                  </a>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
                      Medium
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-accent-emerald filled-icon">check_circle</span>
              </div>

              <div className="px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="flex flex-col gap-1">
                  <a className="text-sm font-medium hover:text-primary transition-colors" href="#">
                    House Robber
                  </a>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20">
                      Easy
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-600">hourglass_empty</span>
              </div>
            </div>
          </div>

          <div className="bg-[#1c2433] rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 flex items-center justify-between cursor-pointer">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary">match_case</span>
                  <h3 className="font-bold text-lg">Strings</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-800 h-1.5 rounded-full max-w-[120px]">
                    <div className="bg-accent-emerald h-1.5 rounded-full" style={{ width: "80%" }}></div>
                  </div>
                  <span className="text-xs font-medium text-slate-400">4/5 Completed</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500">expand_more</span>
            </div>
          </div>

          <div className="bg-[#1c2433] rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 flex items-center justify-between cursor-pointer">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary">view_kanban</span>
                  <h3 className="font-bold text-lg">Arrays</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-800 h-1.5 rounded-full max-w-[120px]">
                    <div className="bg-accent-emerald h-1.5 rounded-full" style={{ width: "100%" }}></div>
                  </div>
                  <span className="text-xs font-medium text-slate-400">5/5 Completed</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500">expand_more</span>
            </div>
          </div>

          <div className="bg-[#1c2433] rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 flex items-center justify-between cursor-pointer">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary">account_tree</span>
                  <h3 className="font-bold text-lg">Graphs</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-800 h-1.5 rounded-full max-w-[120px]">
                    <div className="bg-accent-emerald h-1.5 rounded-full" style={{ width: "20%" }}></div>
                  </div>
                  <span className="text-xs font-medium text-slate-400">1/5 Completed</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500">expand_more</span>
            </div>
          </div>

          <div className="bg-[#1c2433] rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-4 flex items-center justify-between cursor-pointer">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary">savings</span>
                  <h3 className="font-bold text-lg">Greedy</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-800 h-1.5 rounded-full max-w-[120px]">
                    <div className="bg-accent-emerald h-1.5 rounded-full" style={{ width: "40%" }}></div>
                  </div>
                  <span className="text-xs font-medium text-slate-400">2/5 Completed</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500">expand_more</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function PersonalizedContestPage({ onGoDashboard, onOpenPersonalizedSheet, onOpenUpcoming }) {
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
          <a
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            href="#"
          >
            <span className="material-symbols-outlined">public</span>
            <span className="font-medium">Global Contest</span>
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
          <button className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <span className="material-symbols-outlined text-slate-400">sync</span>
          </button>
        </div>
        <div className="flex gap-3 pb-2">
          <button className="flex-1 bg-gradient-to-r from-primary to-[#6366f1] text-white py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">play_arrow</span>
            Start Contest
          </button>
          <button className="flex-1 border border-red-500/30 text-red-500/40 py-2.5 rounded-lg font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">stop</span>
            End Contest
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-32">
        <section className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-purple-500/30 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative contest-glass-card rounded-xl p-6 flex flex-col items-center justify-center text-center overflow-hidden">
            <div className="absolute top-4 right-4 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-[10px] font-bold text-red-500 tracking-widest uppercase">Live</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-mono font-extrabold tracking-widest text-white drop-shadow-sm">01:59:23</h2>
            <p className="text-slate-400 text-sm mt-2 font-medium">Contest Time Remaining</p>
            <div className="mt-4 w-full bg-slate-800/50 h-1 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[65%]" style={{ boxShadow: "0 0 8px #256af4" }}></div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Problems</h3>
            <span className="text-xs text-slate-500 font-medium">4 Total</span>
          </div>

          <div className="contest-glass-card rounded-xl p-4 transition-all active:scale-[0.98]">
            <div className="flex justify-between items-start mb-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-primary font-bold">A</div>
                <div>
                  <h4 className="font-bold text-white">Tree Rotations</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold uppercase">
                      Hard
                    </span>
                    <span className="text-[10px] text-slate-400">• Graphs</span>
                  </div>
                </div>
              </div>
              <span className="status-solved text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">check_circle</span> Solved
              </span>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs font-semibold text-slate-400 tracking-wider">800 PTS</span>
              <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors">
                View Solution
              </button>
            </div>
          </div>

          <div className="contest-glass-card rounded-xl p-4 transition-all active:scale-[0.98] border-l-2 border-l-yellow-500">
            <div className="flex justify-between items-start mb-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-primary font-bold">B</div>
                <div>
                  <h4 className="font-bold text-white">String Matching</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold uppercase">
                      Medium
                    </span>
                    <span className="text-[10px] text-slate-400">• Strings</span>
                  </div>
                </div>
              </div>
              <span className="status-attempted text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">pending</span> Attempted
              </span>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs font-semibold text-slate-400 tracking-wider">500 PTS</span>
              <button className="bg-primary/20 text-primary border border-primary/30 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors">
                Resume
              </button>
            </div>
          </div>

          <div className="contest-glass-card rounded-xl p-4 transition-all active:scale-[0.98]">
            <div className="flex justify-between items-start mb-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-primary font-bold">C</div>
                <div>
                  <h4 className="font-bold text-white">Prefix Sums</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                      Easy
                    </span>
                    <span className="text-[10px] text-slate-400">• Math</span>
                  </div>
                </div>
              </div>
              <span className="status-none text-[10px] font-bold px-2 py-1 rounded-full">Not Attempted</span>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs font-semibold text-slate-400 tracking-wider">300 PTS</span>
              <button className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-primary/10 transition-colors">
                Solve
              </button>
            </div>
          </div>

          <div className="contest-glass-card rounded-xl p-4 transition-all active:scale-[0.98]">
            <div className="flex justify-between items-start mb-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-primary font-bold">D</div>
                <div>
                  <h4 className="font-bold text-white">Dynamic Grid</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold uppercase">
                      Hard
                    </span>
                    <span className="text-[10px] text-slate-400">• DP</span>
                  </div>
                </div>
              </div>
              <span className="status-none text-[10px] font-bold px-2 py-1 rounded-full">Not Attempted</span>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs font-semibold text-slate-400 tracking-wider">1000 PTS</span>
              <button className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-primary/10 transition-colors">
                Solve
              </button>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 md:left-64">
        <div className="bg-background-dark/95 border-t border-slate-800 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white">1/4 Solved</span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1 italic">Keep pushing</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[25%] transition-all duration-500"></div>
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
          <a className="flex flex-col items-center gap-1 text-slate-500" href="#">
            <span className="material-symbols-outlined">public</span>
            <span className="text-[10px] font-medium">Global</span>
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

function UpcomingContestsPage({ onGoDashboard, onOpenPersonalizedSheet, onOpenPersonalizedContest }) {
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
          <a
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            href="#"
          >
            <span className="material-symbols-outlined">public</span>
            <span className="font-medium">Global Contest</span>
          </a>
          <a className="flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2 text-primary" href="#">
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="font-medium">Upcoming Contest</span>
          </a>
        </nav>

        <div className="mt-auto rounded-xl bg-slate-100 p-4 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAq887wRBDbiCSDU6K95-YpV9iKeikbvwxJ-b0eW5bVgf2YrA-dgR9dt1hLIAZ_UMhBPBdnzSTGHBHOQRhHKmK8dlvyIIZw5zGfvuwW02yUZJU5F_kU8diZLDEgb4dblcgSVFE9Hyi4uib3Tcb79kkntBzVXXfBNyqrhmtVsV1TYTo6YStgPCO02gFSxXdV4s2RqaZp0st-Bxy9PttyCTbJ4ebDXMjmOJFyb26cmVBHwm98VKRdyMO1Jt2dUkfBpchC32T0OErsXjI')",
              }}
            ></div>
            <div>
              <p className="text-sm font-bold">tourist_fan</p>
              <p className="text-xs text-slate-500">Expert</p>
            </div>
          </div>
        </div>
      </aside>

      <header className="p-4 pt-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upcoming Contests</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Stay updated with future CP rounds</p>
        </div>
        <button className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          <span className="material-symbols-outlined">sync</span>
        </button>
      </header>

      <section className="px-4 mb-6">
        <div className="bg-white dark:bg-[#161b22] rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base">October 2023</h2>
            <div className="flex gap-2">
              <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-medium text-slate-400 mb-2">
            <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            <div className="h-9"></div>
            <div className="h-9"></div>
            <div className="h-9"></div>
            <div className="relative h-9 flex items-center justify-center text-sm">1</div>
            <div className="relative h-9 flex items-center justify-center text-sm">2</div>
            <div className="relative h-9 flex items-center justify-center text-sm">3</div>
            <div className="relative h-9 flex items-center justify-center text-sm">
              4<span className="absolute bottom-1 w-1 h-1 bg-primary rounded-full active-dot"></span>
            </div>
            <div className="relative h-9 flex items-center justify-center text-sm bg-primary/20 rounded-lg text-primary font-bold border border-primary/30">
              5
            </div>
            <div className="relative h-9 flex items-center justify-center text-sm">6</div>
            <div className="relative h-9 flex items-center justify-center text-sm">
              7<span className="absolute bottom-1 w-1 h-1 bg-accent-purple rounded-full"></span>
            </div>
            <div className="relative h-9 flex items-center justify-center text-sm">8</div>
            <div className="relative h-9 flex items-center justify-center text-sm">9</div>
            <div className="relative h-9 flex items-center justify-center text-sm">10</div>
            <div className="relative h-9 flex items-center justify-center text-sm">11</div>
            <div className="relative h-9 flex items-center justify-center text-sm">
              12<span className="absolute bottom-1 w-1 h-1 bg-primary rounded-full active-dot"></span>
            </div>
            <div className="relative h-9 flex items-center justify-center text-sm">13</div>
            <div className="relative h-9 flex items-center justify-center text-sm">14</div>
            <div className="relative h-9 flex items-center justify-center text-sm">15</div>
            <div className="relative h-9 flex items-center justify-center text-sm">16</div>
            <div className="relative h-9 flex items-center justify-center text-sm">17</div>
            <div className="relative h-9 flex items-center justify-center text-sm">18</div>
            <div className="relative h-9 flex items-center justify-center text-sm">19</div>
            <div className="relative h-9 flex items-center justify-center text-sm">20</div>
            <div className="relative h-9 flex items-center justify-center text-sm">21</div>
          </div>
        </div>
      </section>

      <main className="flex-1 px-4 pb-24 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Upcoming List</h2>
          <span className="text-xs bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-500 font-medium">
            3 Contests Found
          </span>
        </div>
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    Codeforces
                  </span>
                  <span className="text-xs text-slate-500">Div. 2</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-primary">Starts in 2d 4h</p>
                </div>
              </div>
              <h3 className="text-lg font-bold leading-tight mb-3">Codeforces Round 900</h3>
              <div className="grid grid-cols-2 gap-4 text-slate-500 text-sm mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">calendar_today</span>
                  <span>Oct 12, 17:35</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  <span>2.0 hours</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 bg-gradient-to-r from-primary to-accent-purple text-white py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-transform">
                  Register
                </button>
                <button className="px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <span className="material-symbols-outlined text-xl">calendar_add_on</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">
                    AtCoder
                  </span>
                  <span className="text-xs text-slate-500">ABC 320</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400">Starts in 4d 1h</p>
                </div>
              </div>
              <h3 className="text-lg font-bold leading-tight mb-3">AtCoder Beginner Contest 320</h3>
              <div className="grid grid-cols-2 gap-4 text-slate-500 text-sm mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">calendar_today</span>
                  <span>Oct 14, 15:30</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  <span>1.5 hours</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white py-2.5 rounded-lg font-bold text-sm active:scale-95 transition-transform">
                  Details
                </button>
                <button className="px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <span className="material-symbols-outlined text-xl">calendar_add_on</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm opacity-80">
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    Codeforces
                  </span>
                  <span className="text-xs text-slate-500">Educational</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400">Starts in 6d 8h</p>
                </div>
              </div>
              <h3 className="text-lg font-bold leading-tight mb-3">Educational Round 155</h3>
              <div className="grid grid-cols-2 gap-4 text-slate-500 text-sm mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">calendar_today</span>
                  <span>Oct 16, 20:05</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  <span>2.0 hours</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white py-2.5 rounded-lg font-bold text-sm active:scale-95 transition-transform">
                  Register
                </button>
                <button className="px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <span className="material-symbols-outlined text-xl">calendar_add_on</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  const [page, setPage] = useState("signup");

  if (page === "dashboard") {
    return (
      <DashboardPage
        onOpenPersonalizedContest={() => setPage("personalized-contest")}
        onOpenPersonalizedSheet={() => setPage("personalized-sheet")}
        onOpenUpcoming={() => setPage("upcoming-contest")}
      />
    );
  }

  if (page === "personalized-sheet") {
    return (
      <PersonalizedSheetPage
        onGoDashboard={() => setPage("dashboard")}
        onOpenPersonalizedContest={() => setPage("personalized-contest")}
        onOpenUpcoming={() => setPage("upcoming-contest")}
      />
    );
  }

  if (page === "personalized-contest") {
    return (
      <PersonalizedContestPage
        onGoDashboard={() => setPage("dashboard")}
        onOpenPersonalizedSheet={() => setPage("personalized-sheet")}
        onOpenUpcoming={() => setPage("upcoming-contest")}
      />
    );
  }

  if (page === "upcoming-contest") {
    return (
      <UpcomingContestsPage
        onGoDashboard={() => setPage("dashboard")}
        onOpenPersonalizedContest={() => setPage("personalized-contest")}
        onOpenPersonalizedSheet={() => setPage("personalized-sheet")}
      />
    );
  }

  return page === "signup" ? (
    <SignUpPage onAuthSuccess={() => setPage("dashboard")} onGoToLogin={() => setPage("login")} />
  ) : (
    <LoginPage onAuthSuccess={() => setPage("dashboard")} onGoToSignup={() => setPage("signup")} />
  );
}

export default App;
