/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#1978e5",
        "background-light": "#f6f7f8",
        "background-dark": "#111821",
        "card-dark": "#1e293b",
        "accent-purple": "#a855f7",
        "accent-emerald": "#10b981",
        "accent-amber": "#f59e0b",
        "accent-rose": "#f43f5e",
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
      fontFamily: {
        display: ["Arimo", "sans-serif"],
      },
    },
  },
  plugins: [],
};
