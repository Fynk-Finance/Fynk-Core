import { TextField } from '../components/TextField';
import type { StoryGroup } from './types';

export default {
  title: 'TextField',
  stories: {
    Email: () => (
      <TextField label="Correo electrónico" icon="mail" placeholder="tucorreo@ejemplo.com" />
    ),
    Password: () => (
      <TextField label="Contraseña" icon="lock" placeholder="Tu contraseña" secure testID="pwd" />
    ),
    WithHelper: () => (
      <TextField
        label="Nombre"
        icon="user"
        defaultValue="Laura"
        helper="Puedes cambiarlo cuando quieras desde Mi cuenta."
      />
    ),
    Money: () => (
      <TextField
        label="¿Cuánto tienes en efectivo?"
        icon="cash"
        prefix="$"
        placeholder="0"
        defaultValue="600.000"
        keyboardType="number-pad"
      />
    ),
    WithError: () => (
      <TextField label="Correo electrónico" icon="mail" error="Escribe un correo válido." />
    ),
  },
} satisfies StoryGroup;
