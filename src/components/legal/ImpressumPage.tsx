type ImprintData = {
  ownerFullName: string;
  companyLegalForm: string;
  vatId: string;
  registrationNumber: string;
  impressumEmail: string;
  address: string;
  phone: string;
  businessName: string;
};

interface Props {
  imprint: ImprintData;
}

export default function ImpressumPage({ imprint }: Props) {
  return (
    <main className="min-h-screen bg-[--color-bg] text-[--color-text] px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">Impressum</h1>
        <p className="text-sm text-[--color-text-muted] mb-8">Angaben gemäß § 5 DDG</p>

        <div className="bg-[--color-bg-card] border border-[--color-border] rounded-xl p-6 mb-6 space-y-4">
          <Row label="Betreiber">
            <p className="font-semibold">{imprint.ownerFullName}</p>
            {imprint.businessName && imprint.businessName !== imprint.ownerFullName && (
              <p className="text-sm text-[--color-text-muted]">{imprint.businessName}</p>
            )}
          </Row>

          <Row label="Rechtsform">
            <p>{imprint.companyLegalForm}</p>
          </Row>

          {imprint.address && (
            <Row label="Anschrift">
              <p className="whitespace-pre-line">{imprint.address}</p>
            </Row>
          )}

          {imprint.phone && (
            <Row label="Telefon">
              <a href={`tel:${imprint.phone}`} className="text-[--color-accent] hover:underline">
                {imprint.phone}
              </a>
            </Row>
          )}

          {imprint.impressumEmail && (
            <Row label="E-Mail">
              <a href={`mailto:${imprint.impressumEmail}`} className="text-[--color-accent] hover:underline">
                {imprint.impressumEmail}
              </a>
            </Row>
          )}

          {imprint.vatId && (
            <Row label="Umsatzsteuer-ID">
              <p>{imprint.vatId}</p>
            </Row>
          )}

          {imprint.registrationNumber && (
            <Row label="Handelsregisternummer">
              <p>{imprint.registrationNumber}</p>
            </Row>
          )}
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          ⚠️ Diese Seite wurde automatisch erstellt. Bitte prüfen Sie die Angaben auf Vollständigkeit und Richtigkeit.
        </div>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-widest text-[--color-text-muted]">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </div>
  );
}
