/** @type {import('tailwindcss').Config} */
import tailwindCssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        "primary-dark": "hsl(var(--primary-dark))",
        "primary-dark-foreground": "hsl(var(--primary-dark-foreground))",
        "destructive-dark": "hsl(var(--destructive-dark))",
        "destructive-dark-foreground":
          "hsl(var(--destructive-dark-foreground))",
        "secondary-dark": "hsl(var(--secondary-dark))",
        "secondary-dark-foreground": "hsl(var(--secondary-dark-foreground))",
        "accent-dark": "hsl(var(--accent-dark))",
        "accent-dark-foreground": "hsl(var(--accent-dark-foreground))",
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
          hover: "hsl(var(--secondary-hover))",
          "hover-foreground": "hsl(var(--secondary-hover-foreground))",
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
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        authorize: {
          DEFAULT: "hsl(var(--authorize))",
          foreground: "hsl(var(--authorize-foreground))",
          hover: "hsl(var(--authorize-hover))",
          "hover-foreground": "hsl(var(--authorize-hover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: 0,
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: 0,
          },
        },
        "cursor-blink": {
          "0%, 100%": {
            opacity: 1,
          },
          "50%": {
            opacity: 0,
          },
        },
        "shine-infinite": {
          "0%": {
            transform: "skew(-12deg) translateX(-100%)",
          },
          "100%": {
            transform: "skew(-12deg) translateX(100%)",
          },
        },
        "shimmer-slide": {
          to: {
            transform: "translate(calc(100cqw - 100%), 0)",
          },
        },
        "spin-around": {
          "0%": {
            transform: "translateZ(0) rotate(0)",
          },
          "15%, 35%": {
            transform: "translateZ(0) rotate(90deg)",
          },
          "65%, 85%": {
            transform: "translateZ(0) rotate(270deg)",
          },
          "100%": {
            transform: "translateZ(0) rotate(360deg)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "cursor-slow": "cursor-blink 2s step-end infinite",
        "shine-infinite": "shine-infinite 3s ease-in-out infinite",
        "shimmer-slide":
          "shimmer-slide var(--speed) ease-in-out infinite alternate",
        "spin-around": "spin-around calc(var(--speed) * 2) infinite linear",
      },
      fontSize: {
        "mobile-base": "0.875rem",
        "mobile-sm": "0.75rem",
        "mobile-xs": "0.6875rem",
      },
      spacing: {
        mobile: {
          tight: "0.5rem",
          compact: "0.25rem",
        },
      },
    },
  },
  plugins: [tailwindCssAnimate],
};
