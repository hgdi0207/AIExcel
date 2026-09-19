/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-green': '#5FD8A0',
        'brand-green-dark': '#4BC38F',
        'text-primary': '#1A202C',
        'text-secondary': '#718096',
        'bg-gray': '#F7FAFC',
        'border-gray': '#E2E8F0',
        'warning-orange': '#F6AD55',
        'success-green': '#48BB78',
        'error-red': '#F56565',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      },
      borderRadius: {
        'sm': '6px',
        'md': '12px',
        'lg': '20px',
      },
      boxShadow: {
        'light': '0 2px 8px rgba(0,0,0,0.08)',
        'card': '0 4px 12px rgba(0,0,0,0.10)',
        'modal': '0 12px 32px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
