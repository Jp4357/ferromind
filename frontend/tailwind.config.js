/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        head: ["Syne", "sans-serif"],
        mono: ["DM Mono", "monospace"],
        body: ["Literata", "serif"],
      },
      colors: {
        bg: {
          DEFAULT: "#0a0c0f",
          2: "#111418",
          3: "#181d24",
          panel: "#1a2030",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.07)",
          2: "rgba(255,255,255,0.13)",
        },
        ferro: {
          text: "#e8ecf0",
          muted: "#6b7a8d",
          accent: "#f0a500",
          accent2: "#e05c2a",
          green: "#2ecc8b",
          red: "#e8524a",
          blue: "#4a9eff",
          teal: "#2ab8b0",
        },
      },
    },
  },
  plugins: [],
};
