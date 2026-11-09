import { DialogCard, dialog } from '../components/Dialog';
import { PrimaryButton } from '../components/Button';
import type { StoryGroup } from './types';

const noop = () => {};

export default {
  title: 'Dialog',
  stories: {
    Confirm: () => (
      <DialogCard
        title="¿Cerrar sesión?"
        message="Tus datos siguen guardados en este teléfono."
        buttons={[
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar sesión', style: 'destructive' },
        ]}
        onPress={noop}
      />
    ),
    Info: () => (
      <DialogCard
        title="¿Cómo se calcula?"
        message="Sumamos los saldos de tus cuentas conectadas y tu efectivo."
        buttons={[{ text: 'Entendido' }]}
        onPress={noop}
      />
    ),
    Live: () => (
      <PrimaryButton
        label="Abrir diálogo"
        onPress={() =>
          dialog.show('¿Eliminar meta?', 'Se borra con sus aportes.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive' },
          ])
        }
      />
    ),
  },
} satisfies StoryGroup;
