/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050816",
        mist: "#e6ecff",
        peach: "#1c1330",
        sand: "#211238",
        ocean: "#c084fc",
        ember: "#f472b6",
        night: "#0a1020",
        panel: "#0f1324",
        panelSoft: "#171c31",
        line: "#2a2846",
        glow: "#c084fc",
        neon: "#d946ef",
        neonSoft: "#a855f7",
        acid: "#67e8f9",
      },
      boxShadow: {
        float: "0 30px 90px rgba(5, 8, 22, 0.55)",
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Bodoni Moda", "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
