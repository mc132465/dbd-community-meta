import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        button: {
          DEFAULT: "hsl(var(--button))",
          foreground: "hsl(var(--primary-foreground))",
        },
        link: {
          DEFAULT: "hsl(var(--link))",
          hover: "hsl(var(--link-hover))",
        },
        tier: {
          s: "hsl(var(--tier-s))",
          a: "hsl(var(--tier-a))",
          b: "hsl(var(--tier-b))",
          c: "hsl(var(--tier-c))",
          d: "hsl(var(--tier-d))",
          f: "hsl(var(--tier-f))",
        },
        difficulty: {
          beginner: "hsl(var(--difficulty-beginner))",
          intermediate: "hsl(var(--difficulty-intermediate))",
          advanced: "hsl(var(--difficulty-advanced))",
        },
        badge: {
          pending: "hsl(var(--badge-pending))",
          approved: "hsl(var(--badge-approved))",
          rejected: "hsl(var(--badge-rejected))",
          draft: "hsl(var(--badge-draft))",
          archived: "hsl(var(--badge-archived))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
