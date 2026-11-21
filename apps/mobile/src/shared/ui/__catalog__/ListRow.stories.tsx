import { Badge } from '../components/Badge';
import { ListRow } from '../components/ListRow';
import type { StoryGroup } from './types';

export default {
  title: 'ListRow',
  stories: {
    Income: () => (
      <ListRow
        icon="arrowDown"
        title="Salario"
        subtitle="Cuenta de ahorros · 22 sep"
        trailing={{ kind: 'amount', amountMinor: 520000000, signed: true }}
      />
    ),
    Spending: () => (
      <ListRow
        icon="cart"
        title="Supermercado"
        subtitle="Tarjeta débito · 21 sep"
        trailing={{ kind: 'amount', amountMinor: -18430000, signed: true }}
      />
    ),
    Subscription: () => (
      <ListRow
        icon="tv"
        iconTone="accent"
        iconSize={42}
        title="Streaming de series"
        subtitle="Tarjeta de crédito · renueva 2 oct"
        badge={<Badge label="Poco uso" tone="success" />}
        trailing={{ kind: 'amount', amountMinor: 3290000 }}
      />
    ),
    Option: () => (
      <ListRow
        icon="security"
        iconTone="soft"
        iconSize={36}
        title="Seguridad"
        subtitle="Contraseña, huella y Face ID"
        trailing={{ kind: 'chevron' }}
        onPress={() => {}}
      />
    ),
  },
} satisfies StoryGroup;
