import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#0a0a0f",
          900: "#0d0d13",
          850: "#111118",
          800: "#16161f",
          750: "#1c1c27",
          700: "#242430",
        },
        line: {
          DEFAULT: "#242430",
          soft: "#1c1c27",
        },
        ink: {
          DEFAULT: "#e7e7ef",
          muted: "#9a9aab",
          faint: "#6b6b7b",
        },
        accent: {
          teal: "#00d4aa",
          peri: "#7c8aff",
          amber: "#ffaa3d",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
