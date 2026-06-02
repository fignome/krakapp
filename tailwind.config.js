/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#001628',
        slate: '#355464',
        ice: '#99D9D9',
        kraken: '#E9072B',
      },
    },
  },
  plugins: [],
}
