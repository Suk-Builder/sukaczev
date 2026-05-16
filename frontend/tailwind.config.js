/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bili: {
          pink: '#FB7299',
          'pink-dark': '#fc8bab',
          'pink-light': '#ffecf1',
          blue: '#00A1D6',
          'blue-light': '#e6f4fa',
          header: '#18191C',
          'header-hover': '#232429',
          sidebar: '#ffffff',
          bg: '#F1F2F3',
          card: '#ffffff',
          'text-primary': '#18191C',
          'text-secondary': '#61666D',
          'text-tertiary': '#9499A0',
          border: '#E3E5E7',
          'border-light': '#F1F2F3',
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
        ],
      },
      animation: {
        'danmaku': 'danmaku linear',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        danmaku: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.08)',
        'header': '0 2px 10px rgba(0,0,0,0.05)',
      }
    },
  },
  plugins: [],
}
