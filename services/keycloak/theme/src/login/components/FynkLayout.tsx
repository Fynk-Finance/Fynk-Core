import { useEffect, type ReactNode } from 'react';
import '../fonts';
import '../fynk-variables.css';
import '../fynk-layout.css';
import '../fynk-form.css';
import '../fynk-flow.css';
import { FynkHeaderArt } from './FynkHeaderArt';
import { ChevronLeftIcon } from './FynkIcons';
import { FynkLogo } from './FynkLogo';

type Props = {
  /** Text of the browser tab. */
  documentTitle: string;
  headerTitle: string;
  headerSubtitle: string;
  /**
   * Header of the multi step flows (Recuperar.html): a bar with the back button, the small logo and
   * a spacer. Without `backHref` the back button is replaced by an empty spacer.
   */
  flow?: { backHref?: string; backLabel?: string };
  children: ReactNode;
};

// Blue header with the logo, lime band and white card shared by every Fynk login page.
export function FynkLayout({ documentTitle, headerTitle, headerSubtitle, flow, children }: Props) {
  useEffect(() => {
    document.title = `Fynk · ${documentTitle}`;
    document.documentElement.lang = 'es';
  }, [documentTitle]);

  return (
    <div className="fk-page">
      <div className="fk-shell">
        <FynkHeaderArt />
        <header className={`fk-header${flow !== undefined ? ' fk-header--flow' : ''}`}>
          {flow !== undefined ? (
            <div className="fk-flow-bar">
              {flow.backHref !== undefined ? (
                <a className="fk-back" href={flow.backHref} aria-label={flow.backLabel}>
                  <ChevronLeftIcon />
                </a>
              ) : (
                <span className="fk-flow-spacer" aria-hidden="true" />
              )}
              <FynkLogo small />
              <span className="fk-flow-spacer" aria-hidden="true" />
            </div>
          ) : (
            <FynkLogo />
          )}
          <div className="fk-header-text">
            <h1 className="fk-header-title">{headerTitle}</h1>
            <p className="fk-header-subtitle">{headerSubtitle}</p>
          </div>
        </header>
        <div className={`fk-band${flow !== undefined ? ' fk-band--flow' : ''}`}>
          <main className="fk-card">{children}</main>
        </div>
      </div>
    </div>
  );
}
