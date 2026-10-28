// Icons copied from the design (Login.html and Registro.html). All use a 24 px grid and `currentColor`
// unless the caller sets the color through CSS.
const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export function MailIcon() {
  return (
    <svg className="fk-field-icon" width="16" height="16" strokeWidth="2" {...common}>
      <path d="M4 4h16v16H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg className="fk-field-icon" width="16" height="16" strokeWidth="2" {...common}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function EyeIcon(props: { crossed: boolean }) {
  return (
    <svg width="24" height="24" strokeWidth="2" {...common}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {/* The design only draws the open eye. The slash is added for the "hide" state. */}
      {props.crossed && <path d="M3 3l18 18" />}
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg className="fk-cta-arrow" width="24" height="24" strokeWidth="2.4" {...common}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}
