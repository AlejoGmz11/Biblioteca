/** @type {import('tailwindcss').Config} */

// Paleta tierra de MyLibrary
const palette = {
  'dark-walnut': '#582f0e',
  'saddle-brown': '#7f4f24',
  'toffee-brown': '#936639',
  camel: '#a68a64',
  'khaki-beige': '#b6ad90',
  'dry-sage': '#c2c5aa',
  'dry-sage-2': '#a4ac86',
  'dusty-olive': '#656d4a',
  ebony: '#414833',
  'charcoal-brown': '#333d29'
};

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        ...palette,
        // Escala de marca: marrones cálidos (nogal → camel)
        primary: {
          50: '#faf5ee',
          100: '#f2e7d6',
          200: '#e2ccab',
          300: '#c9a97f',
          400: palette.camel,
          500: palette['toffee-brown'],
          600: palette['saddle-brown'],
          700: palette['dark-walnut'],
          800: '#46250b',
          900: '#351c08',
          950: '#241305'
        },
        // Neutros remapeados: salvia/oliva en lugar del gris azulado
        slate: {
          50: '#f7f6f0',
          100: '#edecdd',
          200: palette['dry-sage'],
          300: palette['khaki-beige'],
          400: palette['dry-sage-2'],
          500: '#7d855f',
          600: palette['dusty-olive'],
          700: '#535b3f',
          800: palette.ebony,
          900: palette['charcoal-brown'],
          950: '#262e1e'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
