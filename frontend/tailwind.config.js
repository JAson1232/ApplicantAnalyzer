/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070b1a',
          900: '#0f172a',
          800: '#1e293b'
        },
        gold: {
          400: '#f6c453',
          500: '#d4a337',
          600: '#b8860b'
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 8px 30px rgba(2, 6, 23, 0.45)'
      }
    }
  },
  plugins: []
};
