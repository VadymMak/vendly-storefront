export interface ButtonItem {
  label: string;
  value: string;
}

export interface ChatTranslation {
  greeting: string;
  businessTypes: ButtonItem[];
  demoMessage: string;
  demoButton: string;
  socialProof: string;
  likeButton: string;
  servicesQuestion: string;
  nextButton: string;
  contactQuestion: string;
  trustMessage: string;
  contactPlaceholder: string;
  confirmMessage: (data: { businessTypeLabel: string; services: string; contact: string }) => string;
  confirmYes: string;
  confirmEdit: string;
  thankYou: (contact: string) => string;
  waButton: string;
  editWhat: string;
  editOptions: ButtonItem[];
  serviceOptions: Record<string, ButtonItem[]>;
  progressStep: (step: number) => string;
  progressDone: string;
  businessTypeLabels: Record<string, string>;
}

// ─── Shared service values (same across all languages) ──────────────────────
// Values are language-neutral keys; labels are translated per language.

const SERVICE_VALUES = {
  restaurant: ['menu', 'delivery', 'reservation', 'gallery', 'reviews', 'contacts'],
  auto:        ['diagnostics', 'oil-service', 'tires', 'bodywork', 'electrical', 'pricing'],
  beauty:      ['haircuts', 'coloring', 'manicure', 'massage', 'pricing', 'booking'],
  medical:     ['checkups', 'diagnostics', 'treatment', 'doctors', 'pricing', 'booking'],
  fitness:     ['yoga', 'gym', 'dance', 'schedule', 'memberships', 'trainers'],
  ecommerce:   ['catalog', 'cart', 'payment', 'delivery', 'reviews', 'contacts'],
  photography: ['weddings', 'portraits', 'products', 'events', 'pricing', 'portfolio'],
  bar:         ['menu', 'cocktails', 'reservation', 'events', 'gallery', 'contacts'],
  other:       ['services', 'pricing', 'gallery', 'reviews', 'booking', 'contacts'],
} as const;

function makeOptions(
  type: keyof typeof SERVICE_VALUES,
  labels: string[],
): ButtonItem[] {
  return SERVICE_VALUES[type].map((value, i) => ({ value, label: labels[i] ?? value }));
}

export const CHATBOT_TRANSLATIONS: Record<string, ChatTranslation> = {

  // ════════════════════════════════════════════════════════════════════════════
  // SK — Slovak (primary)
  // ════════════════════════════════════════════════════════════════════════════
  sk: {
    greeting: 'Ahoj! 👋 Pomôžem vám získať profesionálny web za 48 hodín. Aký máte biznis?',
    businessTypes: [
      { label: '🍽️ Reštaurácia / Kaviareň', value: 'restaurant' },
      { label: '🔧 Autoservis / Opravovňa',  value: 'auto' },
      { label: '💈 Salón krásy',             value: 'beauty' },
      { label: '🦷 Medicína / Klinika',       value: 'medical' },
      { label: '🧘 Fitness / Yoga',           value: 'fitness' },
      { label: '🛍️ Obchod / E-shop',         value: 'ecommerce' },
      { label: '📸 Fotograf',                 value: 'photography' },
      { label: '🍺 Bar / Lounge',             value: 'bar' },
      { label: '✏️ Iné',                      value: 'other' },
    ],
    businessTypeLabels: {
      restaurant:  'Reštaurácia / Kaviareň',
      auto:        'Autoservis / Opravovňa',
      beauty:      'Salón krásy',
      medical:     'Medicína / Klinika',
      fitness:     'Fitness / Yoga',
      ecommerce:   'Obchod / E-shop',
      photography: 'Fotograf',
      bar:         'Bar / Lounge',
      other:       'Iné',
    },
    demoMessage:  'Výborne! Takto môže vyzerať vaša webstránka:',
    demoButton:   '🔗 Otvoriť ukážku',
    socialProof:  '11+ projektov • Hotovo za 48 hodín',
    likeButton:   '👍 Páči sa mi! Ďalej →',
    servicesQuestion: 'Aké sekcie potrebujete na webstránke? Vyberte všetko čo sa hodí:',
    nextButton:   '✅ Ďalej →',
    contactQuestion: 'Super! Aby sme vám poslali hotový web — zadajte WhatsApp alebo telefón:',
    trustMessage: '🔒 11+ hotových projektov • Web za 48 hodín • Platíte len ak sa páči',
    contactPlaceholder: '+421...',
    confirmMessage: ({ businessTypeLabel, services, contact }) =>
      `Výborne! Toto som pochopil:\n📋 Biznis: ${businessTypeLabel}\n✅ Sekcie: ${services}\n📱 Kontakt: ${contact}\n\nVšetko správne?`,
    confirmYes:  '✅ Áno, začínajte!',
    confirmEdit: '✏️ Opraviť',
    thankYou: (contact) =>
      `Ďakujeme! 🎉 Vaša webstránka bude hotová za 24–48 hodín.\nNapíšeme vám na ${contact}.\n\n💡 Medzitým môžete pripraviť:\n• Logo\n• 5–10 fotiek\n• Názov biznisu\n\nℹ️ Toto je predbežný príklad. Finálny dizajn preberieme cez WhatsApp.`,
    waButton:    '💬 Napísať nám na WhatsApp',
    editWhat:    'Čo chcete zmeniť?',
    editOptions: [
      { label: 'Typ biznisu', value: 'businessType' },
      { label: 'Sekcie',      value: 'services' },
      { label: 'Kontakt',     value: 'contact' },
    ],
    progressStep: (step) => `Krok ${step} zo 4 • Menej ako minúta`,
    progressDone: 'Hotovo! ✓',
    serviceOptions: {
      restaurant:  makeOptions('restaurant',  ['📋 Menu', '🛵 Rozvoz', '📅 Rezervácia', '📸 Galéria', '💬 Recenzie', '📍 Kontakty']),
      auto:        makeOptions('auto',         ['🔍 Diagnostika', '🛢️ Olej / TÜV', '🔧 Pneumatiky', '🚗 Karoséria', '⚡ Elektrika', '💰 Cenník']),
      beauty:      makeOptions('beauty',       ['✂️ Strihanie', '🎨 Farbenie', '💅 Manikúra', '💆 Masáž', '💰 Cenník', '📅 Rezervácia']),
      medical:     makeOptions('medical',      ['🩺 Prehliadky', '🔬 Diagnostika', '💊 Liečba', '👨‍⚕️ Lekári', '💰 Cenník', '📅 Rezervácia']),
      fitness:     makeOptions('fitness',      ['🧘 Yoga', '💪 Fitness', '💃 Tanec', '📅 Rozvrh', '💰 Permanentky', '👤 Tréneri']),
      ecommerce:   makeOptions('ecommerce',    ['📦 Katalóg', '🛒 Košík', '💳 Platba', '🚚 Doručenie', '⭐ Recenzie', '📞 Kontakty']),
      photography: makeOptions('photography',  ['💒 Svadby', '📸 Portréty', '📦 Produkty', '🎤 Eventy', '💰 Cenník', '📁 Portfólio']),
      bar:         makeOptions('bar',          ['📋 Menu', '🍸 Koktaily', '📅 Rezervácia', '🎵 Eventy', '📸 Galéria', '📍 Kontakty']),
      other:       makeOptions('other',        ['📋 Služby', '💰 Cenník', '📸 Galéria', '💬 Recenzie', '📅 Rezervácia', '📍 Kontakty']),
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // EN — English
  // ════════════════════════════════════════════════════════════════════════════
  en: {
    greeting: "Hi! 👋 I'll help you get a professional website in 48 hours. What's your business?",
    businessTypes: [
      { label: '🍽️ Restaurant / Cafe',    value: 'restaurant' },
      { label: '🔧 Auto Service / Repair', value: 'auto' },
      { label: '💈 Beauty Salon',          value: 'beauty' },
      { label: '🦷 Medical / Clinic',      value: 'medical' },
      { label: '🧘 Fitness / Yoga',        value: 'fitness' },
      { label: '🛍️ Shop / E-commerce',    value: 'ecommerce' },
      { label: '📸 Photographer',          value: 'photography' },
      { label: '🍺 Bar / Lounge',          value: 'bar' },
      { label: '✏️ Other',                 value: 'other' },
    ],
    businessTypeLabels: {
      restaurant:  'Restaurant / Cafe',
      auto:        'Auto Service / Repair',
      beauty:      'Beauty Salon',
      medical:     'Medical / Clinic',
      fitness:     'Fitness / Yoga',
      ecommerce:   'Shop / E-commerce',
      photography: 'Photographer',
      bar:         'Bar / Lounge',
      other:       'Other',
    },
    demoMessage:  "Great! Here's how your website could look:",
    demoButton:   '🔗 View example',
    socialProof:  '11+ projects done • Ready in 48 hours',
    likeButton:   '👍 Looks great! Next →',
    servicesQuestion: 'Which sections do you need on the website? Select all that apply:',
    nextButton:   '✅ Next →',
    contactQuestion: 'Great! To send you the finished website — enter your WhatsApp or phone:',
    trustMessage: '🔒 11+ finished projects • Website in 48 hours • Pay only if you like it',
    contactPlaceholder: '+421...',
    confirmMessage: ({ businessTypeLabel, services, contact }) =>
      `Great! Here's what I understood:\n📋 Business: ${businessTypeLabel}\n✅ Sections: ${services}\n📱 Contact: ${contact}\n\nIs everything correct?`,
    confirmYes:  "✅ Yes, let's start!",
    confirmEdit: '✏️ Edit',
    thankYou: (contact) =>
      `Thank you! 🎉 Your website will be ready in 24–48 hours.\nWe'll write to you at ${contact}.\n\n💡 In the meantime, prepare:\n• Logo\n• 5–10 photos\n• Business name\n\nℹ️ This is a preliminary example. We'll discuss the final design via WhatsApp.`,
    waButton:    '💬 Message us on WhatsApp',
    editWhat:    'What would you like to change?',
    editOptions: [
      { label: 'Business Type', value: 'businessType' },
      { label: 'Sections',      value: 'services' },
      { label: 'Contact',       value: 'contact' },
    ],
    progressStep: (step) => `Step ${step} of 4 • Less than a minute`,
    progressDone: 'Done! ✓',
    serviceOptions: {
      restaurant:  makeOptions('restaurant',  ['📋 Menu', '🛵 Delivery', '📅 Reservation', '📸 Gallery', '💬 Reviews', '📍 Contacts']),
      auto:        makeOptions('auto',         ['🔍 Diagnostics', '🛢️ Oil / Service', '🔧 Tires', '🚗 Bodywork', '⚡ Electrical', '💰 Pricing']),
      beauty:      makeOptions('beauty',       ['✂️ Haircuts', '🎨 Coloring', '💅 Manicure', '💆 Massage', '💰 Pricing', '📅 Booking']),
      medical:     makeOptions('medical',      ['🩺 Checkups', '🔬 Diagnostics', '💊 Treatment', '👨‍⚕️ Doctors', '💰 Pricing', '📅 Booking']),
      fitness:     makeOptions('fitness',      ['🧘 Yoga', '💪 Fitness', '💃 Dance', '📅 Schedule', '💰 Memberships', '👤 Trainers']),
      ecommerce:   makeOptions('ecommerce',    ['📦 Catalog', '🛒 Cart', '💳 Payment', '🚚 Delivery', '⭐ Reviews', '📞 Contacts']),
      photography: makeOptions('photography',  ['💒 Weddings', '📸 Portraits', '📦 Products', '🎤 Events', '💰 Pricing', '📁 Portfolio']),
      bar:         makeOptions('bar',          ['📋 Menu', '🍸 Cocktails', '📅 Reservation', '🎵 Events', '📸 Gallery', '📍 Contacts']),
      other:       makeOptions('other',        ['📋 Services', '💰 Pricing', '📸 Gallery', '💬 Reviews', '📅 Booking', '📍 Contacts']),
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // DE — German
  // ════════════════════════════════════════════════════════════════════════════
  de: {
    greeting: 'Hallo! 👋 Ich helfe Ihnen, in 48 Stunden eine professionelle Website zu bekommen. Welches Unternehmen haben Sie?',
    businessTypes: [
      { label: '🍽️ Restaurant / Café',         value: 'restaurant' },
      { label: '🔧 KFZ-Werkstatt / Reparatur', value: 'auto' },
      { label: '💈 Schönheitssalon',            value: 'beauty' },
      { label: '🦷 Medizin / Klinik',           value: 'medical' },
      { label: '🧘 Fitness / Yoga',             value: 'fitness' },
      { label: '🛍️ Geschäft / E-Shop',         value: 'ecommerce' },
      { label: '📸 Fotograf',                   value: 'photography' },
      { label: '🍺 Bar / Lounge',               value: 'bar' },
      { label: '✏️ Sonstiges',                  value: 'other' },
    ],
    businessTypeLabels: {
      restaurant:  'Restaurant / Café',
      auto:        'KFZ-Werkstatt / Reparatur',
      beauty:      'Schönheitssalon',
      medical:     'Medizin / Klinik',
      fitness:     'Fitness / Yoga',
      ecommerce:   'Geschäft / E-Shop',
      photography: 'Fotograf',
      bar:         'Bar / Lounge',
      other:       'Sonstiges',
    },
    demoMessage:  'Ausgezeichnet! So könnte Ihre Website aussehen:',
    demoButton:   '🔗 Beispiel öffnen',
    socialProof:  '11+ Projekte • Fertig in 48 Stunden',
    likeButton:   '👍 Gefällt mir! Weiter →',
    servicesQuestion: 'Welche Bereiche brauchen Sie auf der Website? Wählen Sie alles Passende:',
    nextButton:   '✅ Weiter →',
    contactQuestion: 'Super! Um Ihnen die fertige Website zu senden — geben Sie WhatsApp oder Telefon an:',
    trustMessage: '🔒 11+ fertige Projekte • Website in 48 Stunden • Zahlen nur wenn gefällt',
    contactPlaceholder: '+421...',
    confirmMessage: ({ businessTypeLabel, services, contact }) =>
      `Ausgezeichnet! Das habe ich verstanden:\n📋 Unternehmen: ${businessTypeLabel}\n✅ Bereiche: ${services}\n📱 Kontakt: ${contact}\n\nIst alles korrekt?`,
    confirmYes:  '✅ Ja, loslegen!',
    confirmEdit: '✏️ Korrigieren',
    thankYou: (contact) =>
      `Danke! 🎉 Ihre Website wird in 24–48 Stunden fertig sein.\nWir schreiben Ihnen an ${contact}.\n\n💡 In der Zwischenzeit können Sie vorbereiten:\n• Logo\n• 5–10 Fotos\n• Unternehmensname\n\nℹ️ Dies ist ein vorläufiges Beispiel. Das endgültige Design besprechen wir per WhatsApp.`,
    waButton:    '💬 WhatsApp schreiben',
    editWhat:    'Was möchten Sie ändern?',
    editOptions: [
      { label: 'Unternehmenstyp', value: 'businessType' },
      { label: 'Bereiche',        value: 'services' },
      { label: 'Kontakt',         value: 'contact' },
    ],
    progressStep: (step) => `Schritt ${step} von 4 • Weniger als eine Minute`,
    progressDone: 'Fertig! ✓',
    serviceOptions: {
      restaurant:  makeOptions('restaurant',  ['📋 Speisekarte', '🛵 Lieferung', '📅 Reservierung', '📸 Galerie', '💬 Bewertungen', '📍 Kontakte']),
      auto:        makeOptions('auto',         ['🔍 Diagnose', '🛢️ Öl / TÜV', '🔧 Reifen', '🚗 Karosserie', '⚡ Elektrik', '💰 Preisliste']),
      beauty:      makeOptions('beauty',       ['✂️ Haarschnitt', '🎨 Färben', '💅 Maniküre', '💆 Massage', '💰 Preisliste', '📅 Buchung']),
      medical:     makeOptions('medical',      ['🩺 Untersuchungen', '🔬 Diagnostik', '💊 Behandlung', '👨‍⚕️ Ärzte', '💰 Preisliste', '📅 Termin']),
      fitness:     makeOptions('fitness',      ['🧘 Yoga', '💪 Fitness', '💃 Tanzen', '📅 Stundenplan', '💰 Mitgliedschaft', '👤 Trainer']),
      ecommerce:   makeOptions('ecommerce',    ['📦 Katalog', '🛒 Warenkorb', '💳 Zahlung', '🚚 Lieferung', '⭐ Bewertungen', '📞 Kontakte']),
      photography: makeOptions('photography',  ['💒 Hochzeiten', '📸 Porträts', '📦 Produkte', '🎤 Events', '💰 Preisliste', '📁 Portfolio']),
      bar:         makeOptions('bar',          ['📋 Speisekarte', '🍸 Cocktails', '📅 Reservierung', '🎵 Events', '📸 Galerie', '📍 Kontakte']),
      other:       makeOptions('other',        ['📋 Leistungen', '💰 Preisliste', '📸 Galerie', '💬 Bewertungen', '📅 Buchung', '📍 Kontakte']),
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // CS — Czech
  // ════════════════════════════════════════════════════════════════════════════
  cs: {
    greeting: 'Ahoj! 👋 Pomůžu vám získat profesionální web za 48 hodin. Jaké máte podnikání?',
    businessTypes: [
      { label: '🍽️ Restaurace / Kavárna', value: 'restaurant' },
      { label: '🔧 Autoservis / Opravna',  value: 'auto' },
      { label: '💈 Salón krásy',           value: 'beauty' },
      { label: '🦷 Medicína / Klinika',    value: 'medical' },
      { label: '🧘 Fitness / Jóga',        value: 'fitness' },
      { label: '🛍️ Obchod / E-shop',      value: 'ecommerce' },
      { label: '📸 Fotograf',              value: 'photography' },
      { label: '🍺 Bar / Lounge',          value: 'bar' },
      { label: '✏️ Jiné',                  value: 'other' },
    ],
    businessTypeLabels: {
      restaurant:  'Restaurace / Kavárna',
      auto:        'Autoservis / Opravna',
      beauty:      'Salón krásy',
      medical:     'Medicína / Klinika',
      fitness:     'Fitness / Jóga',
      ecommerce:   'Obchod / E-shop',
      photography: 'Fotograf',
      bar:         'Bar / Lounge',
      other:       'Jiné',
    },
    demoMessage:  'Skvěle! Takto může vypadat váš web:',
    demoButton:   '🔗 Otevřít ukázku',
    socialProof:  '11+ projektů • Hotovo za 48 hodin',
    likeButton:   '👍 Líbí se mi! Dál →',
    servicesQuestion: 'Jaké sekce potřebujete na webu? Vyberte vše co se hodí:',
    nextButton:   '✅ Dál →',
    contactQuestion: 'Skvěle! Abychom vám poslali hotový web — zadejte WhatsApp nebo telefon:',
    trustMessage: '🔒 11+ hotových projektů • Web za 48 hodin • Platíte jen pokud se líbí',
    contactPlaceholder: '+421...',
    confirmMessage: ({ businessTypeLabel, services, contact }) =>
      `Skvěle! Toto jsem pochopil:\n📋 Firma: ${businessTypeLabel}\n✅ Sekce: ${services}\n📱 Kontakt: ${contact}\n\nVše správně?`,
    confirmYes:  '✅ Ano, začínáme!',
    confirmEdit: '✏️ Opravit',
    thankYou: (contact) =>
      `Děkujeme! 🎉 Váš web bude hotový za 24–48 hodin.\nNapíšeme vám na ${contact}.\n\n💡 Mezitím můžete připravit:\n• Logo\n• 5–10 fotek\n• Název firmy\n\nℹ️ Toto je předběžný příklad. Finální design probereme přes WhatsApp.`,
    waButton:    '💬 Napsat nám na WhatsApp',
    editWhat:    'Co chcete změnit?',
    editOptions: [
      { label: 'Typ podnikání', value: 'businessType' },
      { label: 'Sekce',         value: 'services' },
      { label: 'Kontakt',       value: 'contact' },
    ],
    progressStep: (step) => `Krok ${step} ze 4 • Méně než minuta`,
    progressDone: 'Hotovo! ✓',
    serviceOptions: {
      restaurant:  makeOptions('restaurant',  ['📋 Menu', '🛵 Rozvoz', '📅 Rezervace', '📸 Galerie', '💬 Recenze', '📍 Kontakty']),
      auto:        makeOptions('auto',         ['🔍 Diagnostika', '🛢️ Olej / STK', '🔧 Pneumatiky', '🚗 Karoserie', '⚡ Elektrika', '💰 Ceník']),
      beauty:      makeOptions('beauty',       ['✂️ Střihání', '🎨 Barvení', '💅 Manikúra', '💆 Masáž', '💰 Ceník', '📅 Rezervace']),
      medical:     makeOptions('medical',      ['🩺 Prohlídky', '🔬 Diagnostika', '💊 Léčba', '👨‍⚕️ Lékaři', '💰 Ceník', '📅 Rezervace']),
      fitness:     makeOptions('fitness',      ['🧘 Yoga', '💪 Fitness', '💃 Tanec', '📅 Rozvrh', '💰 Permanentky', '👤 Trenéři']),
      ecommerce:   makeOptions('ecommerce',    ['📦 Katalog', '🛒 Košík', '💳 Platba', '🚚 Doručení', '⭐ Recenze', '📞 Kontakty']),
      photography: makeOptions('photography',  ['💒 Svatby', '📸 Portréty', '📦 Produkty', '🎤 Eventy', '💰 Ceník', '📁 Portfolio']),
      bar:         makeOptions('bar',          ['📋 Menu', '🍸 Koktejly', '📅 Rezervace', '🎵 Eventy', '📸 Galerie', '📍 Kontakty']),
      other:       makeOptions('other',        ['📋 Služby', '💰 Ceník', '📸 Galerie', '💬 Recenze', '📅 Rezervace', '📍 Kontakty']),
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // UK — Ukrainian
  // ════════════════════════════════════════════════════════════════════════════
  uk: {
    greeting: 'Привіт! 👋 Допоможу отримати професійний сайт за 48 годин. Який у вас бізнес?',
    businessTypes: [
      { label: '🍽️ Ресторан / Кафе',     value: 'restaurant' },
      { label: '🔧 Автосервіс / Ремонт', value: 'auto' },
      { label: '💈 Салон краси',          value: 'beauty' },
      { label: '🦷 Медицина / Клініка',   value: 'medical' },
      { label: '🧘 Фітнес / Yoga',        value: 'fitness' },
      { label: '🛍️ Магазин / E-shop',    value: 'ecommerce' },
      { label: '📸 Фотограф',             value: 'photography' },
      { label: '🍺 Бар / Лаунж',          value: 'bar' },
      { label: '✏️ Інше',                 value: 'other' },
    ],
    businessTypeLabels: {
      restaurant:  'Ресторан / Кафе',
      auto:        'Автосервіс / Ремонт',
      beauty:      'Салон краси',
      medical:     'Медицина / Клініка',
      fitness:     'Фітнес / Yoga',
      ecommerce:   'Магазин / E-shop',
      photography: 'Фотограф',
      bar:         'Бар / Лаунж',
      other:       'Інше',
    },
    demoMessage:  'Чудово! Ось як може виглядати ваш сайт:',
    demoButton:   '🔗 Відкрити приклад',
    socialProof:  '11+ проектів • Готово за 48 годин',
    likeButton:   '👍 Подобається! Далі →',
    servicesQuestion: 'Які розділи потрібні на сайті? Виберіть усе що підходить:',
    nextButton:   '✅ Далі →',
    contactQuestion: 'Чудово! Щоб надіслати вам готовий сайт — вкажіть WhatsApp або телефон:',
    trustMessage: '🔒 11+ готових проектів • Сайт за 48 годин • Платите тільки якщо сподобається',
    contactPlaceholder: '+421...',
    confirmMessage: ({ businessTypeLabel, services, contact }) =>
      `Чудово! Ось що я зрозумів:\n📋 Бізнес: ${businessTypeLabel}\n✅ Розділи: ${services}\n📱 Контакт: ${contact}\n\nВсе вірно?`,
    confirmYes:  '✅ Так, починайте!',
    confirmEdit: '✏️ Виправити',
    thankYou: (contact) =>
      `Дякуємо! 🎉 Ваш сайт буде готовий за 24–48 годин.\nНапишемо вам на ${contact}.\n\n💡 Поки що можете підготувати:\n• Логотип\n• 5–10 фото\n• Назву бізнесу\n\nℹ️ Це попередній приклад. Фінальний дизайн обговоримо через WhatsApp.`,
    waButton:    '💬 Написати нам у WhatsApp',
    editWhat:    'Що хочете змінити?',
    editOptions: [
      { label: 'Тип бізнесу', value: 'businessType' },
      { label: 'Розділи',     value: 'services' },
      { label: 'Контакт',     value: 'contact' },
    ],
    progressStep: (step) => `Крок ${step} з 4 • Менше хвилини`,
    progressDone: 'Готово! ✓',
    serviceOptions: {
      restaurant:  makeOptions('restaurant',  ['📋 Меню', '🛵 Доставка', '📅 Бронювання', '📸 Галерея', '💬 Відгуки', '📍 Контакти']),
      auto:        makeOptions('auto',         ['🔍 Діагностика', '🛢️ Масло / ТО', '🔧 Шини', '🚗 Кузов', '⚡ Електрика', '💰 Прайс']),
      beauty:      makeOptions('beauty',       ['✂️ Стрижки', '🎨 Фарбування', '💅 Манікюр', '💆 Масаж', '💰 Прайс', '📅 Запис']),
      medical:     makeOptions('medical',      ['🩺 Огляди', '🔬 Діагностика', '💊 Лікування', '👨‍⚕️ Лікарі', '💰 Прайс', '📅 Запис']),
      fitness:     makeOptions('fitness',      ['🧘 Yoga', '💪 Фітнес', '💃 Танці', '📅 Розклад', '💰 Абонементи', '👤 Тренери']),
      ecommerce:   makeOptions('ecommerce',    ['📦 Каталог', '🛒 Кошик', '💳 Оплата', '🚚 Доставка', '⭐ Відгуки', '📞 Контакти']),
      photography: makeOptions('photography',  ['💒 Весілля', '📸 Портрети', '📦 Продукти', '🎤 Івенти', '💰 Прайс', '📁 Портфоліо']),
      bar:         makeOptions('bar',          ['📋 Меню', '🍸 Коктейлі', '📅 Бронювання', '🎵 Івенти', '📸 Галерея', '📍 Контакти']),
      other:       makeOptions('other',        ['📋 Послуги', '💰 Прайс', '📸 Галерея', '💬 Відгуки', '📅 Запис', '📍 Контакти']),
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // RU — Russian
  // ════════════════════════════════════════════════════════════════════════════
  ru: {
    greeting: 'Привет! 👋 Помогу получить профессиональный сайт за 48 часов. Какой у вас бизнес?',
    businessTypes: [
      { label: '🍽️ Ресторан / Кафе',    value: 'restaurant' },
      { label: '🔧 Автосервис / Ремонт', value: 'auto' },
      { label: '💈 Салон красоты',        value: 'beauty' },
      { label: '🦷 Медицина / Клиника',   value: 'medical' },
      { label: '🧘 Фитнес / Yoga',        value: 'fitness' },
      { label: '🛍️ Магазин / E-shop',    value: 'ecommerce' },
      { label: '📸 Фотограф',             value: 'photography' },
      { label: '🍺 Бар / Лаунж',          value: 'bar' },
      { label: '✏️ Другое',               value: 'other' },
    ],
    businessTypeLabels: {
      restaurant:  'Ресторан / Кафе',
      auto:        'Автосервис / Ремонт',
      beauty:      'Салон красоты',
      medical:     'Медицина / Клиника',
      fitness:     'Фитнес / Yoga',
      ecommerce:   'Магазин / E-shop',
      photography: 'Фотограф',
      bar:         'Бар / Лаунж',
      other:       'Другое',
    },
    demoMessage:  'Отлично! Вот как может выглядеть ваш сайт:',
    demoButton:   '🔗 Открыть пример',
    socialProof:  'Уже сделали 11+ проектов • Готово за 48 часов',
    likeButton:   '👍 Нравится! Далее →',
    servicesQuestion: 'Какие разделы нужны на сайте? Выберите все что подходит:',
    nextButton:   '✅ Далее →',
    contactQuestion: 'Отлично! Чтобы отправить готовый сайт — укажите WhatsApp или телефон:',
    trustMessage: '🔒 11+ готовых проектов • Сайт за 48 часов • Платите только если понравится',
    contactPlaceholder: '+421...',
    confirmMessage: ({ businessTypeLabel, services, contact }) =>
      `Отлично! Вот что я понял:\n📋 Бизнес: ${businessTypeLabel}\n✅ Разделы: ${services}\n📱 Контакт: ${contact}\n\nВсё верно?`,
    confirmYes:  '✅ Да, начинайте!',
    confirmEdit: '✏️ Исправить',
    thankYou: (contact) =>
      `Спасибо! 🎉 Ваш сайт будет готов через 24–48 часов.\nМы напишем вам на ${contact}.\n\n💡 Пока можете подготовить:\n• Логотип\n• 5–10 фото\n• Название бизнеса\n\nℹ️ Это предварительный пример. Финальный дизайн обсудим через WhatsApp.`,
    waButton:    '💬 Написать нам в WhatsApp',
    editWhat:    'Что хотите изменить?',
    editOptions: [
      { label: 'Тип бизнеса', value: 'businessType' },
      { label: 'Разделы',     value: 'services' },
      { label: 'Контакт',     value: 'contact' },
    ],
    progressStep: (step) => `Шаг ${step} из 4 • Меньше минуты`,
    progressDone: 'Готово! ✓',
    serviceOptions: {
      restaurant:  makeOptions('restaurant',  ['📋 Меню', '🛵 Доставка', '📅 Резервация', '📸 Галерея', '💬 Отзывы', '📍 Контакты']),
      auto:        makeOptions('auto',         ['🔍 Диагностика', '🛢️ Масло / ТО', '🔧 Шины', '🚗 Кузов', '⚡ Электрика', '💰 Прайс']),
      beauty:      makeOptions('beauty',       ['✂️ Стрижки', '🎨 Окрашивание', '💅 Маникюр', '💆 Массаж', '💰 Прайс', '📅 Запись']),
      medical:     makeOptions('medical',      ['🩺 Осмотры', '🔬 Диагностика', '💊 Лечение', '👨‍⚕️ Врачи', '💰 Прайс', '📅 Запись']),
      fitness:     makeOptions('fitness',      ['🧘 Yoga', '💪 Фитнес', '💃 Танцы', '📅 Расписание', '💰 Абонементы', '👤 Тренеры']),
      ecommerce:   makeOptions('ecommerce',    ['📦 Каталог', '🛒 Корзина', '💳 Оплата', '🚚 Доставка', '⭐ Отзывы', '📞 Контакты']),
      photography: makeOptions('photography',  ['💒 Свадьбы', '📸 Портреты', '📦 Продукты', '🎤 Eventy', '💰 Прайс', '📁 Портфолио']),
      bar:         makeOptions('bar',          ['📋 Меню', '🍸 Коктейли', '📅 Резервация', '🎵 Events', '📸 Галерея', '📍 Контакты']),
      other:       makeOptions('other',        ['📋 Услуги', '💰 Прайс', '📸 Галерея', '💬 Отзывы', '📅 Запись', '📍 Контакты']),
    },
  },
};
