import { strings } from '../strings.es-CO';

// Logo mark and word, copied from the design (Login.html header).
export function FynkLogo() {
  return (
    <div className="fk-logo" role="img" aria-label={strings.brand}>
      <svg width="34" height="42" viewBox="80 20 510 640" aria-hidden="true">
        <g transform="matrix(1,-0.16,0,1,0,0)" fill="#ffffff">
          <path d="M130,126 H540 Q570,126 570,156 V230 Q570,252 548,252 H262 Q240,252 240,274 V383 Q240,405 262,405 H548 Q570,405 570,427 V531 Q570,561 540,561 H130 Q100,561 100,531 V156 Q100,126 130,126 Z" />
          <rect x="262" y="268" width="120" height="120" rx="38" />
          <path d="M152,588 H345 V680 Q345,696 330,689 Z" />
        </g>
      </svg>
      <span className="fk-logo-word" aria-hidden="true">
        {strings.brand}
      </span>
    </div>
  );
}
