/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Nested summa.* — generates bg-summa-navy, text-summa-ink, etc. */
        summa: {
          navy:           '#212f87',
          'navy-hover':   '#1a2570',
          magenta:        '#d52680',
          'magenta-hover':'#b51e69',
          cyan:           '#7dc7e9',
          'cyan-hover':   '#5ab0d9',
          purple:         '#959bcc',
          surface:        '#f9f8fc',
          'surface-dark': '#ede8f8',
          ink:            '#3d3963',
          'ink-light':    '#6b6894',
          border:         '#d8d4ed',
        },
        /* Flat aliases — generates bg-summaNavy, bg-summaMagenta, etc. */
        summaNavy:      '#212f87',
        summaMagenta:   '#d52680',
        summaCyan:      '#7dc7e9',
        summaPurple:    '#959bcc',
        summaGray:      '#3d3963',
        summaLavender:  '#d9d9fc',
        summaSky:       '#d9f5ff',
        summaHuman:     '#fff0f9',
      },
      backgroundColor: {
        'summa-navy':    '#212f87',
        'summa-magenta': '#d52680',
        'summa-cyan':    '#7dc7e9',
        'summa-purple':  '#959bcc',
        'summa-gray':    '#3d3963',
      },
      fontFamily: {
        sans: [
          '"Futura PT"',
          '"Outfit"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
      backgroundImage: {
        'summa-gradient':        'linear-gradient(135deg, #212f87 0%, #d52680 100%)',
        'summa-gradient-r':      'linear-gradient(135deg, #d52680 0%, #7dc7e9 100%)',
        'summa-gradient-soft':   'linear-gradient(135deg, #f9f8fc 0%, #ede8f8 100%)',
        'summa-gradient-header': 'linear-gradient(90deg, #212f87 0%, #2d3f9f 100%)',
      },
      boxShadow: {
        'summa-sm': '0 1px 4px 0 rgba(33,47,135,0.08)',
        'summa':    '0 2px 12px 0 rgba(33,47,135,0.12)',
        'summa-md': '0 4px 24px 0 rgba(33,47,135,0.16)',
        'summa-lg': '0 8px 40px 0 rgba(33,47,135,0.20)',
        'accent':   '0 4px 20px 0 rgba(213,38,128,0.25)',
      },
      borderRadius: {
        'summa':    '10px',
        'summa-lg': '16px',
        'summa-xl': '24px',
      },
      animation: {
        'fade-in':  'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
