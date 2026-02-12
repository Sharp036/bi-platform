/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a',
        },
        surface: {
          0: '#ffffff', 50: '#f8fafc', 100: '#f1f5f9',
          200: '#e2e8f0', 300: '#cbd5e1',
        },
        'dark-surface': {
          0: '#0f172a', 50: '#1e293b', 100: '#334155',
          200: '#475569', 300: '#64748b',
        },
      },
    },
  },
  plugins: [],
}
