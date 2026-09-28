/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          light: 'rgb(var(--color-primary) / <alpha-value>)',
          dark: 'rgb(var(--color-primary) / <alpha-value>)'
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          light: 'rgb(var(--color-secondary-light) / <alpha-value>)',
          dark: 'rgb(var(--color-secondary-dark) / <alpha-value>)'
        },
        dark: {
          DEFAULT: '#000',
          100: '#161616',
          200: '#2d2d2d',
          300: '#3d3d3d'
        },
        light: {
          DEFAULT: '#fff',
          100: '#f8f9fa',
          200: '#e9ecef',
          300: '#dee2e6'
        }
      }
    }
  },
  plugins: []
};
