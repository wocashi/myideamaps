/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#7c3aed',
        'primary-light': '#f5f3ff',
        coral: '#ff6b6b',
        mint: '#06d6a0',
        surface: '#fafaff',
        card: '#ffffff',
        border: '#e5e7ff',
        muted: '#9ca3af',
        ink: '#1e1b4b',
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
