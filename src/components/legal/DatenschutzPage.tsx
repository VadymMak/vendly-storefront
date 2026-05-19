type ImprintData = {
  ownerFullName: string;
  impressumEmail: string;
  address: string;
  businessName: string;
  companyLegalForm: string;
  phone: string;
} | null;

interface Props {
  imprint?: ImprintData | Record<string, string> | null;
}

export default function DatenschutzPage({ imprint }: Props) {
  const name    = imprint?.ownerFullName  ?? '';
  const email   = imprint?.impressumEmail ?? '';
  const address = imprint?.address        ?? '';

  return (
    <main className="min-h-screen bg-[--color-bg] text-[--color-text] px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Datenschutzerklärung</h1>
          <p className="text-sm text-[--color-text-muted]">
            Zuletzt aktualisiert: {new Date().getFullYear()}
          </p>
        </div>

        <Section title="1. Verantwortlicher">
          <p>
            Verantwortlicher im Sinne der DSGVO (Art. 4 Nr. 7):
          </p>
          {name && <p className="font-semibold mt-2">{name}</p>}
          {address && <p className="whitespace-pre-line text-[--color-text-muted]">{address}</p>}
          {email && (
            <p className="mt-1">
              E-Mail:{' '}
              <a href={`mailto:${email}`} className="text-[--color-accent] hover:underline">
                {email}
              </a>
            </p>
          )}
        </Section>

        <Section title="2. Datenerhebung und -verarbeitung">
          <Subsection title="Kontaktformular">
            <p>
              Wenn Sie unser Kontaktformular nutzen, werden die von Ihnen angegebenen Daten (Name,
              E-Mail-Adresse, Nachricht) zum Zweck der Bearbeitung Ihrer Anfrage und für eventuelle
              Anschlussfragen gespeichert. Diese Daten geben wir ohne Ihre Einwilligung nicht weiter.
              Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).
            </p>
          </Subsection>
          <Subsection title="Buchungen und Termine">
            <p>
              Bei Buchungen oder Terminanfragen erheben wir Name, Telefonnummer und ggf. E-Mail-Adresse,
              um Ihren Termin zu bestätigen und zu verwalten. Die Daten werden nach Abschluss des Vorgangs
              gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten bestehen.
              Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
            </p>
          </Subsection>
        </Section>

        <Section title="3. Google Maps">
          <p>
            Diese Website verwendet Google Maps zur Darstellung von Karten. Anbieter ist die Google
            Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Google Maps wird erst nach
            Ihrer ausdrücklichen Einwilligung über unseren Cookie-Banner aktiviert.
          </p>
          <p className="mt-2">
            Bei aktivierter Nutzung werden Daten (insbesondere Ihre IP-Adresse) an Server von Google
            übertragen, die sich auch außerhalb der EU befinden können. Weitere Informationen finden
            Sie in der{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[--color-accent] hover:underline"
            >
              Datenschutzerklärung von Google
            </a>
            . Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
          </p>
        </Section>

        <Section title="4. Ihre Rechte">
          <p>Sie haben gegenüber uns folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:</p>
          <ul className="mt-3 space-y-2 list-none">
            {[
              ['Auskunft', 'Art. 15 DSGVO — Sie können Auskunft über die von uns gespeicherten Daten verlangen.'],
              ['Berichtigung', 'Art. 16 DSGVO — Sie können die Berichtigung unrichtiger Daten verlangen.'],
              ['Löschung', 'Art. 17 DSGVO — Sie können die Löschung Ihrer Daten verlangen, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.'],
              ['Einschränkung', 'Art. 18 DSGVO — Sie können die Einschränkung der Verarbeitung verlangen.'],
              ['Widerspruch', 'Art. 21 DSGVO — Sie können der Verarbeitung Ihrer Daten widersprechen, wenn sie auf Basis eines berechtigten Interesses erfolgt.'],
              ['Datenübertragbarkeit', 'Art. 20 DSGVO — Sie können Ihre Daten in einem strukturierten, maschinenlesbaren Format erhalten.'],
            ].map(([right, desc]) => (
              <li key={right} className="flex gap-2">
                <span className="font-semibold shrink-0">{right}:</span>
                <span className="text-[--color-text-muted]">{desc}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[--color-text-muted] text-sm">
            Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
          </p>
        </Section>

        <Section title="5. Kontakt Datenschutz">
          <p>
            Bei Fragen zum Datenschutz wenden Sie sich bitte an uns:
          </p>
          {email ? (
            <p className="mt-2">
              <a href={`mailto:${email}`} className="text-[--color-accent] hover:underline">
                {email}
              </a>
            </p>
          ) : (
            <p className="mt-2 text-[--color-text-muted]">[E-Mail-Adresse eintragen]</p>
          )}
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3 pb-2 border-b border-[--color-border]">{title}</h2>
      <div className="text-[--color-text-muted] space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="font-semibold text-[--color-text] mb-1">{title}</h3>
      {children}
    </div>
  );
}
