import { MoneyField } from '../components/MoneyField';
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
      <MoneyField
        label="¿Cuánto tienes en efectivo?"
        icon="cash"
        placeholder="0"
        defaultValue="600000"
      />
    ),
    WithError: () => (
      <TextField label="Correo electrónico" icon="mail" error="Escribe un correo válido." />
    ),
  },
} satisfies StoryGroup;
