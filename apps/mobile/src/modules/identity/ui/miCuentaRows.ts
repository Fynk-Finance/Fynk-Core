// The "Gestión de cuenta" rows of Mi cuenta, in the order they are drawn. Other modules add their
// rows (Notificaciones, Privacidad y datos, Centro de ayuda) here in small pull requests.
import { APPEARANCE_ROUTE } from '@shared/navigation';
import type { IconName } from '@shared/ui';

import { identityStrings } from './strings.es-CO';

const rows = identityStrings.miCuenta.rows;

export type MiCuentaRowTarget = { kind: 'navigate'; route: string } | { kind: 'signOut' };

export interface MiCuentaRow {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  target: MiCuentaRowTarget;
}

export const SECURITY_ROUTE = 'identity.Security' as const;

export const miCuentaRows: readonly MiCuentaRow[] = [
  {
    id: 'security',
    ...rows.security,
    icon: 'security',
    target: { kind: 'navigate', route: SECURITY_ROUTE },
  },
  {
    id: 'appearance',
    ...rows.appearance,
    icon: 'monitor',
    target: { kind: 'navigate', route: APPEARANCE_ROUTE },
  },
  { id: 'signOut', ...rows.signOut, icon: 'logout', target: { kind: 'signOut' } },
];
