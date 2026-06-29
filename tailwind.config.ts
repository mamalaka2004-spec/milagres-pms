import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        brand: {
          50: "#F7F5F0",
          100: "#F0EBE0",
          200: "#E2D9C8",
          300: "#C9BBA4",
          400: "#8A9B7E",
          500: "#6B7F5E",
          600: "#4A5A40",
          700: "#3A4832",
          800: "#2A3424",
          900: "#1A2416",
        },
        cream: "#FDFBF7",
      },
      fontFamily: {
        heading: ['"Cormorant Garamond"', "serif"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      // ── Elevation tokens — one consistent ramp for the whole shell ──
      // card: resting surfaces · card-hover: interactive lift ·
      // dropdown: floating menus · overlay: modals & sheets.
      boxShadow: {
        card: "0 1px 3px 0 rgb(26 36 22 / 0.06), 0 6px 16px -4px rgb(26 36 22 / 0.10)",
        "card-hover":
          "0 8px 28px -6px rgb(26 36 22 / 0.16), 0 4px 10px -4px rgb(26 36 22 / 0.10)",
        dropdown:
          "0 12px 34px -8px rgb(26 36 22 / 0.18), 0 4px 10px -4px rgb(26 36 22 / 0.10)",
        overlay: "0 24px 60px -15px rgb(26 36 22 / 0.30)",
      },
      // ── Spacing tokens — named rhythm used by Section/PageHeader/stacks ──
      spacing: {
        gutter: "1rem", // base screen padding (16px)
        "gutter-lg": "1.5rem", // desktop gutter (24px)
        section: "1.5rem", // vertical gap between page sections
      },
      zIndex: {
        dropdown: "50",
        overlay: "50",
        toast: "60",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-bottom": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "translateY(4px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out",
        "slide-in-right": "slide-in-right 0.25s ease-out",
        "slide-in-left": "slide-in-left 0.25s ease-out",
        "slide-in-bottom": "slide-in-bottom 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.16s ease-out",
        "progress-indeterminate": "progress-indeterminate 0.9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
