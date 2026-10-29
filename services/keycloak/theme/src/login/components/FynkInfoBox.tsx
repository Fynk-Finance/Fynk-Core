import type { ReactNode } from 'react';
import { ShieldIcon } from './FynkIcons';

// Small box with a shield: blue in Recuperar.html, lime in OnbCorreo.html.
export function FynkInfoBox({ tone, children }: { tone: 'blue' | 'lime'; children: ReactNode }) {
  return (
    <div className={`fk-box fk-box--${tone}`}>
      <ShieldIcon />
      <span>{children}</span>
    </div>
  );
}
