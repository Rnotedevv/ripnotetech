/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#070b14',
        panel: '#0f1729',
        line: '#1f2940',
        accent: '#7c3aed',
        accent2: '#06b6d4',
        soft: '#94a3b8'
      },
      boxShadow: {
        glow: '0 20px 60px rgba(124,58,237,0.25)'
      },
      backgroundImage: {
        hero: 'radial-gradient(circle at top left, rgba(124,58,237,0.18), transparent 30%), radial-gradient(circle at top right, rgba(6,182,212,0.18), transparent 30%), linear-gradient(180deg, #050816, #0b1020 48%, #050816 100%)'
      }
    }
  },
  plugins: []
};
