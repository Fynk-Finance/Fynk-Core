import { useState, type ChangeEventHandler, type FocusEventHandler, type ReactNode } from 'react';
import { strings } from '../strings.es-CO';
import { EyeIcon, LockIcon, MailIcon } from './FynkIcons';

type Props = {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'password';
  icon?: 'mail' | 'lock';
  autoComplete?: string;
  placeholder?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  /** Controlled value, used with `onChange`. */
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  hint?: string;
  /** Error shown under the field. `errorId` links it to the input. */
  error?: ReactNode;
  /** Marks the field red without its own message (another field shows the message). */
  invalid?: boolean;
  /** Id of an error message shown elsewhere, linked with aria-describedby. */
  describedBy?: string;
  spacing?: 'default' | 'tight' | 'last';
  /** Content placed under the field inside the same group (for example the "forgot" link). */
  children?: ReactNode;
};

// Label, input with its left icon and optional show/hide button, hint and error (Login.html).
export function FynkField(props: Props) {
  const { id, type, icon, hint, error, invalid, describedBy, spacing = 'default' } = props;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const hintId = hint !== undefined ? `${id}-hint` : undefined;
  const errorId = error !== undefined && error !== null ? `${id}-error` : undefined;
  const describedByIds = [describedBy, errorId, hintId].filter(Boolean).join(' ') || undefined;
  const isInvalid = invalid === true || errorId !== undefined;

  return (
    <div className={`fk-group${spacing === 'default' ? '' : ` fk-group--${spacing}`}`}>
      <label className="fk-label" htmlFor={id}>
        {props.label}
      </label>
      <div className={`fk-field${isPassword ? ' fk-field--toggle' : ''}`} data-invalid={isInvalid}>
        {icon === 'mail' && <MailIcon />}
        {icon === 'lock' && <LockIcon />}
        <input
          className="fk-input"
          id={id}
          name={props.name}
          type={isPassword && revealed ? 'text' : type}
          autoComplete={props.autoComplete}
          placeholder={props.placeholder}
          defaultValue={props.defaultValue}
          value={props.value}
          onChange={props.onChange}
          onBlur={props.onBlur}
          aria-invalid={isInvalid}
          aria-describedby={describedByIds}
        />
        {isPassword && (
          <button
            className="fk-eye"
            type="button"
            aria-label={revealed ? strings.hidePassword : strings.showPassword}
            aria-controls={id}
            aria-pressed={revealed}
            onClick={() => setRevealed((value) => !value)}
          >
            <EyeIcon crossed={revealed} />
          </button>
        )}
      </div>
      {hint !== undefined && (
        <p className="fk-hint" id={hintId}>
          {hint}
        </p>
      )}
      {errorId !== undefined && (
        <p className="fk-error" id={errorId} aria-live="polite">
          {error}
        </p>
      )}
      {props.children}
    </div>
  );
}
