import { useEffect, type ReactNode } from 'react';
import '../fonts';
import '../fynk-variables.css';
import '../fynk-layout.css';
import '../fynk-form.css';
import { FynkHeaderArt } from './FynkHeaderArt';
import { FynkLogo } from './FynkLogo';

type Props = {
  /** Text of the browser tab. */
  documentTitle: string;
  headerTitle: string;
  headerSubtitle: string;
  children: ReactNode;
};

// Blue header with the logo, lime band and white card shared by every Fynk login page.
export function FynkLayout({ documentTitle, headerTitle, headerSubtitle, children }: Props) {
  useEffect(() => {
    document.title = `Fynk · ${documentTitle}`;
    document.documentElement.lang = 'es';
  }, [documentTitle]);

  return (
    <div className="fk-page">
      <div className="fk-shell">
        <FynkHeaderArt />
        <header className="fk-header">
          <FynkLogo />
          <div className="fk-header-text">
            <h1 className="fk-header-title">{headerTitle}</h1>
            <p className="fk-header-subtitle">{headerSubtitle}</p>
          </div>
        </header>
        <div className="fk-band">
          <main className="fk-card">{children}</main>
        </div>
      </div>
    </div>
  );
}
