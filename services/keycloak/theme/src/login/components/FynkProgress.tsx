type Props = { step: number; total: number; label: string };

// Step dots of the recovery flow (Recuperar.html): the current step is a long blue pill, the done
// ones short blue pills and the next ones short grey pills.
export function FynkProgress({ step, total, label }: Props) {
  return (
    <div
      className="fk-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className="fk-progress-dot"
          data-state={index + 1 === step ? 'current' : index + 1 < step ? 'done' : 'todo'}
        />
      ))}
    </div>
  );
}
