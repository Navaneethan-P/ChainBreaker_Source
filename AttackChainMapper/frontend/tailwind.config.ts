import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0B0F17",
        "bg-panel": "#141B26",
        "bg-card": "#1A2333",
        accent: "#00D9FF",
        critical: "#FF3B5C",
        high: "#FFA630",
        low: "#3DDC97",
        "text-primary": "#E8EDF2",
        "text-muted": "#8B98A9",
        border: "#1E2A3A",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "Space Grotesk", "sans-serif"],
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
