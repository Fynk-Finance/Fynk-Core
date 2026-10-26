import { AccentButton, GhostButton, PrimaryButton } from '../components/Button';
import type { StoryGroup } from './types';

export default {
  title: 'Buttons',
  stories: {
    Primary: () => <PrimaryButton label="Continuar" withArrow onPress={() => {}} />,
    PrimaryLoading: () => <PrimaryButton label="Ingresar" loading />,
    PrimaryDisabled: () => <PrimaryButton label="Ingresar" disabled />,
    Accent: () => <AccentButton label="Empezar" withArrow onPress={() => {}} />,
    Ghost: () => <GhostButton label="Ahora no" onPress={() => {}} />,
    GhostNeutralLarge: () => (
      <GhostButton label="Huella o Face ID" icon="fingerprint" tone="neutral" size="lg" />
    ),
    GhostDanger: () => <GhostButton label="Eliminar cuenta" icon="trash" tone="danger" />,
  },
} satisfies StoryGroup;
