import type { ReactNode } from 'react';
import { AlertIcon, ArrowIcon, CheckIcon } from './FynkIcons';

type Props = {
  tone: 'success' | 'error';
  title: string;
  /** Message block. Its container gets `messageId` (Keycloak's pages and the tests look for it). */
  children: ReactNode;
  messageId: string;
  /** Button at the bottom, a link because Keycloak gives a URL, not a form. */
  action?: { href: string; label: string };
  /** Plain text shown instead of the button when Keycloak gives no URL to go to. */
  noActionHint?: string;
};

// Body of the success, info and error pages: a round mark, a title, the message and one button.
export function FynkStatus({ tone, title, children, messageId, action, noActionHint }: Props) {
  return (
    <div className="fk-status">
      <span
        className={`fk-status-mark${tone === 'error' ? ' fk-status-mark--error' : ''}`}
        aria-hidden="true"
      >
        {tone === 'error' ? <AlertIcon /> : <CheckIcon size={36} />}
      </span>
      <h2 className="fk-card-title">{title}</h2>
      <div id={messageId} className="fk-status-body">
        {children}
      </div>
      {action !== undefined ? (
        <a className="fk-cta" href={action.href}>
          <span>{action.label}</span>
          <ArrowIcon />
        </a>
      ) : (
        noActionHint !== undefined && (
          <p className="fk-status-message fk-status-hint">{noActionHint}</p>
        )
      )}
    </div>
  );
}
