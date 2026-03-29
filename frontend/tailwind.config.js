/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#f8fafc",
        peach: "#fff7ed",
        sand: "#fef3c7",
        ocean: "#0f766e",
        ember: "#c2410c",
      },
      boxShadow: {
        float: "0 24px 60px rgba(15, 23, 42, 0.12)",
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
