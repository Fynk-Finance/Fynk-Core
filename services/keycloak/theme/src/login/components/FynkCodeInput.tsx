import { useRef, useState, type KeyboardEvent } from 'react';

type Props = {
  describedBy?: string;
  invalid?: boolean;
};

const LENGTH = 6;

// Six code boxes (OnbCorreo.html) over ONE real input named `code`. The input is transparent and
// covers the boxes, so paste, one-time-code autofill, backspace, long press and screen readers all
// work on a single native field; the boxes only draw its value. The caret is kept at the end so the
// active box is always the next empty one. Enter submits with the "verify" button, not "resend".
// The visible <label for="code"> is rendered by the page.
export function FynkCodeInput({ describedBy, invalid }: Props) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const keepCaretAtEnd = () => {
    const input = inputRef.current;
    if (input === null) return;
    const end = input.value.length;
    // A real selection (select all, then type or paste) is left alone; only a bare caret is moved.
    if (input.selectionStart === input.selectionEnd && input.selectionStart !== end) {
      input.setSelectionRange(end, end);
    }
  };

  const submitWithVerify = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const form = event.currentTarget.form;
    const verify = form?.querySelector<HTMLButtonElement>('button[name="verify"]');
    if (form && verify) {
      form.requestSubmit(verify);
    }
  };

  const active = Math.min(value.length, LENGTH - 1);

  return (
    <div className="fk-code" data-invalid={invalid === true}>
      <div className="fk-code-boxes" aria-hidden="true">
        {Array.from({ length: LENGTH }, (_, index) => (
          <span
            key={index}
            className="fk-code-box"
            data-filled={index < value.length}
            data-active={focused && index === active}
          >
            {value[index] ?? (focused && index === active ? <i className="fk-code-caret" /> : null)}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        className="fk-code-input"
        id="code"
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        pattern="[0-9]*"
        autoFocus
        aria-describedby={describedBy}
        aria-invalid={invalid === true}
        value={value}
        onChange={(event) => setValue(event.target.value.replace(/\D/g, '').slice(0, LENGTH))}
        onFocus={() => {
          setFocused(true);
          keepCaretAtEnd();
        }}
        onBlur={() => setFocused(false)}
        onSelect={keepCaretAtEnd}
        onKeyDown={submitWithVerify}
      />
    </div>
  );
}
