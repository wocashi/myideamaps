/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sea: '#e8f4fd',
        'sea-deep': '#cce3f8',
        primary: '#2563eb',
        'primary-light': '#eff6ff',
        surface: '#f8fafc',
        card: '#ffffff',
        border: '#e2e8f0',
        muted: '#94a3b8',
        ink: '#0f172a',
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 4px 0 rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px 0 rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
