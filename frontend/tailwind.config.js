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

// Las escalas `primary`, `slate` y `white` salen de variables CSS para que cada tema
// tenga sus propios valores: los del modo claro y el oscuro están en src/styles.css.
const themed = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const themedScale = (prefix) =>
  Object.fromEntries(STEPS.map((step) => [step, themed(`${prefix}-${step}`)]));

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        ...palette,
        // En modo claro no hay blanco puro: `white` es el crema de la paleta
        white: themed('white'),
        // Escala de marca (acento)
        primary: themedScale('primary'),
        // Neutros: fondos, bordes y texto
        slate: themedScale('slate')
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
