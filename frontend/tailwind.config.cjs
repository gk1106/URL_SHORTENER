/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: { extend: {
    fontFamily: { sans: ['Space Mono', 'monospace'] },
    colors: { accent: '#00FFFF', magenta: '#FF006E', muted: '#B3A9C4' }
  } },
  plugins: []
};
