import { ArrowIcon } from './FynkIcons';

type Props = {
  label: string;
  /** Keycloak's login form posts this name; the registration form does not use one. */
  name?: string;
  id?: string;
  spaced?: boolean;
};

// Primary blue submit button with the arrow (Login.html `.cta`).
export function FynkButton({ label, name, id, spaced }: Props) {
  return (
    <button
      className={`fk-cta${spaced === true ? ' fk-cta--spaced' : ''}`}
      type="submit"
      name={name}
      id={id}
      value={name !== undefined ? label : undefined}
    >
      <span>{label}</span>
      <ArrowIcon />
    </button>
  );
}
