const paths = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  applications: 'M8 5V3h8v2 M3 6h18v14H3z M3 11h18 M10 11v3h4v-3',
  board: 'M3 4h5v16H3z M10 4h5v11h-5z M17 4h4v14h-4z',
  companies: 'M4 21V4h11v17 M15 10h5v11 M8 8h3 M8 12h3 M8 16h3 M2 21h20',
  chart: 'M4 3v17h17 M8 16v-4 M13 16V7 M18 16V4',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  logout: 'M10 4H4v16h6 M14 8l4 4-4 4 M9 12h12',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'M6 6l12 12 M6 18 18 6',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  plus: 'M12 5v14 M5 12h14',
  calendar: 'M5 5h14v15H5z M8 3v4 M16 3v4 M5 10h14 M9 14h1 M14 14h1',
  check: 'M5 12l4 4L19 6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
  spark: 'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
}
export default function Icon({ name, className = '' }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name] || paths.applications} /></svg>
}
