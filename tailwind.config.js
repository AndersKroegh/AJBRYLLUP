/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm ivory canvas + antique gold — inviting and elegant
        ivory: {
          DEFAULT: "#FBF8F3",
          50: "#FFFDFA",
          100: "#FDFBF7",
          200: "#F5EFE6",
        },
        ink: {
          DEFAULT: "#2E2A26", // warm near-black
          soft: "#6B6259",
          faint: "#9A9088",
        },
        gold: {
          DEFAULT: "#B08D57", // antique / champagne gold
          soft: "#C7A876",
          deep: "#8F6F41",
        },
        blush: "#E7D3CB",
        sage: "#8E9C86", // quiet nod to Risskov & the mountains
        line: "#EAE3D8",
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.35em',
      },
      boxShadow: {
        soft: '0 2px 20px -8px rgba(46, 42, 38, 0.12)',
        lift: '0 24px 60px -24px rgba(46, 42, 38, 0.28)',
        glass: '0 8px 32px -16px rgba(46, 42, 38, 0.24)',
      },
      transitionTimingFunction: {
        // Spring-like, Apple-ish settle (critically damped feel)
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        floaty: 'floaty 3.5s ease-in-out infinite',
        shimmer: 'shimmer 6s linear infinite',
        'fade-up': 'fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
