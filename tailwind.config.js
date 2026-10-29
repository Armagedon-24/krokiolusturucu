/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#F5C518',
          600: '#d4a017',
          700: '#b8860b',
          800: '#92660a',
          900: '#7a5308',
          950: '#5c3d06',
        },
        dark: {
          900: '#0a0a0a',
          800: '#111111',
          700: '#1a1a1a',
          600: '#1e1e1e',
          500: '#242424',
          400: '#2a2a2a',
          300: '#333333',
          200: '#444444',
          100: '#666666',
        },
      },
    },
  },
  plugins: [],
}
