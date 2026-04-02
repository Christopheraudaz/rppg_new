/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0f172a',
        'bg-secondary': '#1e293b',
        'bg-card': '#334155',
        'text-primary': '#f8fafc',
        'text-secondary': '#94a3b8',
        'accent-primary': '#38bdf8',
        'accent-secondary': '#818cf8',
      },
    },
  },
  plugins: [],
}