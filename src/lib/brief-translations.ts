// Brief form translations for 6 languages.
// Used in src/app/brief/[leadId]/page.tsx (public client brief form).

export interface BriefT {
  heading: string;
  subtitle: string;
  // Section 1
  s1Title: string;
  labelBizName: string;
  labelAddress: string;
  phAddress: string;
  labelEmail: string;
  labelHours: string;
  phHours: string;
  // Section 2
  s2Title: string;
  labelYourServices: string;
  labelAdditional: string;
  phAdditional: string;
  labelPriceList: string;
  hintPriceList: string;
  dragPriceList: string;
  // Section 3
  s3Title: string;
  labelPalette: string;
  labelHero: string;
  labelMood: string;
  palettes: Record<string, string>;
  heros: Record<string, string>;
  moods: Record<string, string>;
  // Section 4
  s4Title: string;
  labelLogo: string;
  dragLogo: string;
  hintLogo: string;
  labelPhotos: string;
  dragPhotos: string;
  hintPhotos: string;
  photoHintByType: Record<string, string>;
  hintMaxPhotos: string;
  // Section 5
  s5Title: string;
  labelInstagram: string;
  phInstagram: string;
  labelFacebook: string;
  phFacebook: string;
  labelReference: string;
  phReference: string;
  labelWishes: string;
  phWishes: string;
  // Actions
  submit: string;
  submitting: string;
  uploading: string;
  uploadError: string;
  deletePhoto: string;
  // Thank you
  thankTitle: string;
  thankSubtitle: string;
  thankContact: string;
  thankWa: string;
  // Page states
  invalidLink: string;
  alreadyTitle: string;
  alreadySubtitle: string;
  loadingText: string;
}

const photoHintSk: Record<string, string> = {
  auto: 'Dielňa • Vybavenie • Hotové práce • Tím',
  restaurant: 'Sála • Jedlá • Kuchyňa • Fasáda',
  beauty: 'Interiér • Ukážky práce • Pracovisko',
  medical: 'Ambulancia • Vybavenie • Tím lekárov',
  fitness: 'Sála • Vybavenie • Cvičenia',
  photography: 'Vaše najlepšie práce (10–20 fotiek)',
  bar: 'Interiér • Nápoje • Atmosféra',
  ecommerce: 'Tovar • Balenie • Sklad',
  other: 'Akékoľvek fotky vášho podniku',
};

const photoHintEn: Record<string, string> = {
  auto: 'Workshop • Equipment • Finished jobs • Team',
  restaurant: 'Dining room • Dishes • Kitchen • Facade',
  beauty: 'Interior • Portfolio • Workstation',
  medical: 'Office • Equipment • Medical team',
  fitness: 'Gym • Equipment • Classes',
  photography: 'Your best works (10–20 photos)',
  bar: 'Interior • Drinks • Atmosphere',
  ecommerce: 'Products • Packaging • Warehouse',
  other: 'Any photos of your business',
};

const photoHintDe: Record<string, string> = {
  auto: 'Werkstatt • Ausrüstung • Fertige Arbeiten • Team',
  restaurant: 'Speisesaal • Gerichte • Küche • Fassade',
  beauty: 'Innenraum • Portfolio • Arbeitsplatz',
  medical: 'Praxis • Ausstattung • Ärzteteam',
  fitness: 'Gym • Geräte • Kurse',
  photography: 'Ihre besten Werke (10–20 Fotos)',
  bar: 'Innenraum • Getränke • Atmosphäre',
  ecommerce: 'Produkte • Verpackung • Lager',
  other: 'Beliebige Fotos Ihres Unternehmens',
};

const photoHintCs: Record<string, string> = {
  auto: 'Dílna • Vybavení • Hotové práce • Tým',
  restaurant: 'Sál • Jídla • Kuchyně • Fasáda',
  beauty: 'Interiér • Ukázky práce • Pracoviště',
  medical: 'Ordinace • Vybavení • Tým lékařů',
  fitness: 'Sál • Vybavení • Cvičení',
  photography: 'Vaše nejlepší práce (10–20 fotek)',
  bar: 'Interiér • Nápoje • Atmosféra',
  ecommerce: 'Zboží • Balení • Sklad',
  other: 'Jakékoli fotky vašeho podniku',
};

const photoHintUk: Record<string, string> = {
  auto: 'Майстерня • Обладнання • Готові роботи • Команда',
  restaurant: 'Зал • Страви • Кухня • Фасад',
  beauty: 'Інтер\'єр • Приклади робіт • Робоче місце',
  medical: 'Кабінет • Обладнання • Команда лікарів',
  fitness: 'Зал • Обладнання • Заняття',
  photography: 'Ваші найкращі роботи (10–20 фото)',
  bar: 'Інтер\'єр • Напої • Атмосфера',
  ecommerce: 'Товари • Упаковка • Склад',
  other: 'Будь-які фото вашого бізнесу',
};

const photoHintRu: Record<string, string> = {
  auto: 'Мастерская • Оборудование • Готовые работы • Команда',
  restaurant: 'Зал • Блюда • Кухня • Фасад',
  beauty: 'Интерьер • Примеры работ • Рабочее место',
  medical: 'Кабинет • Оборудование • Команда врачей',
  fitness: 'Зал • Оборудование • Занятия',
  photography: 'Ваши лучшие работы (10–20 фото)',
  bar: 'Интерьер • Напитки • Атмосфера',
  ecommerce: 'Товары • Упаковка • Склад',
  other: 'Любые фото вашего бизнеса',
};

export const BRIEF_TRANSLATIONS: Record<string, BriefT> = {
  sk: {
    heading: 'Brief pre váš web',
    subtitle: 'Vyplňte brief • Váš web bude hotový do 48 hodín',
    s1Title: 'O vašom podniku',
    labelBizName: 'Názov podniku',
    labelAddress: 'Adresa',
    phAddress: 'Hlavná 15, Bratislava',
    labelEmail: 'Email',
    labelHours: 'Pracovné hodiny',
    phHours: 'Po–Pi 8:00–18:00, So 9:00–14:00',
    s2Title: 'Služby a ceny',
    labelYourServices: 'Vybrané sekcie',
    labelAdditional: 'Ďalšie služby alebo cenník',
    phAdditional: 'Napíšte ďalšie služby, ceny, špeciálne ponuky...',
    labelPriceList: 'Nahrať cenník',
    hintPriceList: 'PDF alebo fotka',
    dragPriceList: 'Presuňte cenník alebo kliknite',
    s3Title: 'Štýl vášho webu',
    labelPalette: 'Farebná paleta',
    labelHero: 'Štýl hlavnej obrazovky',
    labelMood: 'Nálada webu',
    palettes: {
      dark: 'Tmavý prémiový',
      light: 'Čistý svetlý',
      warm: 'Teplý útulný',
      professional: 'Profesionálny',
      natural: 'Prírodný',
      custom: 'Podľa vášho vkusu',
    },
    heros: {
      fullscreen: 'Celá obrazovka',
      split: 'Rozdelené (text + obrázok)',
      centered: 'Centrovaný',
    },
    moods: {
      modern: '🔲 Moderný minimalistický',
      cozy: '🏠 Teplý a útulný',
      strict: '👔 Striktný profesionálny',
    },
    s4Title: 'Fotky a logo',
    labelLogo: 'Logo',
    dragLogo: 'Presuňte logo alebo kliknite',
    hintLogo: 'PNG, JPG, SVG, WebP',
    labelPhotos: 'Fotky podniku',
    dragPhotos: 'Presuňte fotky alebo kliknite',
    hintPhotos: 'Nahrajte 5–10 fotiek vášho podniku',
    photoHintByType: photoHintSk,
    hintMaxPhotos: 'Max 20 fotiek',
    s5Title: 'Doplňujúce informácie',
    labelInstagram: 'Instagram',
    phInstagram: '@vasafirma',
    labelFacebook: 'Facebook',
    phFacebook: 'facebook.com/vasafirma',
    labelReference: 'Web, ktorý sa vám páči',
    phReference: 'https://...',
    labelWishes: 'Akékoľvek priania',
    phWishes: 'Povedzte nám, čo je pre vás dôležité...',
    submit: 'Odoslať brief →',
    submitting: 'Odosiela sa...',
    uploading: 'Nahrávam...',
    uploadError: 'Chyba nahrávania',
    deletePhoto: 'Odstrániť',
    thankTitle: 'Ďakujeme! Brief bol prijatý.',
    thankSubtitle: 'Váš web bude hotový do 24–48 hodín.',
    thankContact: 'Napíšeme vám na',
    thankWa: 'Napísať nám cez WhatsApp',
    invalidLink: 'Odkaz nie je platný alebo vypršal.',
    alreadyTitle: 'Ďakujeme! Brief bol prijatý.',
    alreadySubtitle: 'Váš web je v príprave.',
    loadingText: 'Načítava sa...',
  },

  en: {
    heading: 'Brief for your website',
    subtitle: 'Fill in the brief • Your website will be ready in 48 hours',
    s1Title: 'About your business',
    labelBizName: 'Business name',
    labelAddress: 'Address',
    phAddress: '15 Main St, Bratislava',
    labelEmail: 'Email',
    labelHours: 'Working hours',
    phHours: 'Mon–Fri 8:00–18:00, Sat 9:00–14:00',
    s2Title: 'Services & pricing',
    labelYourServices: 'Selected sections',
    labelAdditional: 'Additional services or pricing',
    phAdditional: 'List additional services, prices, special offers...',
    labelPriceList: 'Upload price list',
    hintPriceList: 'PDF or photo',
    dragPriceList: 'Drop price list here or click',
    s3Title: 'Website style',
    labelPalette: 'Color palette',
    labelHero: 'Hero screen style',
    labelMood: 'Website mood',
    palettes: {
      dark: 'Dark premium',
      light: 'Clean light',
      warm: 'Warm cozy',
      professional: 'Professional',
      natural: 'Natural',
      custom: 'Your choice',
    },
    heros: {
      fullscreen: 'Fullscreen',
      split: 'Split (text + image)',
      centered: 'Centered',
    },
    moods: {
      modern: '🔲 Modern minimalist',
      cozy: '🏠 Warm and cozy',
      strict: '👔 Strict professional',
    },
    s4Title: 'Photos & logo',
    labelLogo: 'Logo',
    dragLogo: 'Drop logo here or click',
    hintLogo: 'PNG, JPG, SVG, WebP',
    labelPhotos: 'Business photos',
    dragPhotos: 'Drop photos here or click',
    hintPhotos: 'Upload 5–10 photos of your business',
    photoHintByType: photoHintEn,
    hintMaxPhotos: 'Max 20 photos',
    s5Title: 'Additional info',
    labelInstagram: 'Instagram',
    phInstagram: '@yourbusiness',
    labelFacebook: 'Facebook',
    phFacebook: 'facebook.com/yourbusiness',
    labelReference: 'Website you like',
    phReference: 'https://...',
    labelWishes: 'Any wishes',
    phWishes: 'Tell us what is important to you...',
    submit: 'Submit brief →',
    submitting: 'Submitting...',
    uploading: 'Uploading...',
    uploadError: 'Upload error',
    deletePhoto: 'Remove',
    thankTitle: 'Thank you! Brief received.',
    thankSubtitle: 'Your website will be ready in 24–48 hours.',
    thankContact: 'We will write to you at',
    thankWa: 'Write us on WhatsApp',
    invalidLink: 'This link is invalid or has expired.',
    alreadyTitle: 'Thank you! Brief received.',
    alreadySubtitle: 'Your website is being prepared.',
    loadingText: 'Loading...',
  },

  de: {
    heading: 'Brief für Ihre Website',
    subtitle: 'Füllen Sie den Brief aus • Ihre Website ist in 48 Stunden fertig',
    s1Title: 'Über Ihr Unternehmen',
    labelBizName: 'Unternehmensname',
    labelAddress: 'Adresse',
    phAddress: 'Hauptstraße 15, Bratislava',
    labelEmail: 'E-Mail',
    labelHours: 'Öffnungszeiten',
    phHours: 'Mo–Fr 8:00–18:00, Sa 9:00–14:00',
    s2Title: 'Dienstleistungen & Preise',
    labelYourServices: 'Ausgewählte Abschnitte',
    labelAdditional: 'Weitere Dienste oder Preisliste',
    phAdditional: 'Weitere Dienste, Preise, Sonderangebote...',
    labelPriceList: 'Preisliste hochladen',
    hintPriceList: 'PDF oder Foto',
    dragPriceList: 'Preisliste hier ablegen oder klicken',
    s3Title: 'Website-Stil',
    labelPalette: 'Farbpalette',
    labelHero: 'Hauptbild-Stil',
    labelMood: 'Website-Stimmung',
    palettes: {
      dark: 'Dunkles Premium',
      light: 'Sauberes Licht',
      warm: 'Warm & gemütlich',
      professional: 'Professionell',
      natural: 'Natürlich',
      custom: 'Nach Ihrem Geschmack',
    },
    heros: {
      fullscreen: 'Vollbild',
      split: 'Geteilt (Text + Bild)',
      centered: 'Zentriert',
    },
    moods: {
      modern: '🔲 Modern minimalistisch',
      cozy: '🏠 Warm und gemütlich',
      strict: '👔 Streng professionell',
    },
    s4Title: 'Fotos & Logo',
    labelLogo: 'Logo',
    dragLogo: 'Logo hier ablegen oder klicken',
    hintLogo: 'PNG, JPG, SVG, WebP',
    labelPhotos: 'Unternehmensfotos',
    dragPhotos: 'Fotos hier ablegen oder klicken',
    hintPhotos: '5–10 Fotos Ihres Unternehmens hochladen',
    photoHintByType: photoHintDe,
    hintMaxPhotos: 'Max. 20 Fotos',
    s5Title: 'Zusätzliche Informationen',
    labelInstagram: 'Instagram',
    phInstagram: '@ihrunternehmen',
    labelFacebook: 'Facebook',
    phFacebook: 'facebook.com/ihrunternehmen',
    labelReference: 'Website, die Ihnen gefällt',
    phReference: 'https://...',
    labelWishes: 'Beliebige Wünsche',
    phWishes: 'Erzählen Sie uns, was Ihnen wichtig ist...',
    submit: 'Brief absenden →',
    submitting: 'Wird gesendet...',
    uploading: 'Hochladen...',
    uploadError: 'Upload-Fehler',
    deletePhoto: 'Entfernen',
    thankTitle: 'Danke! Brief erhalten.',
    thankSubtitle: 'Ihre Website ist in 24–48 Stunden fertig.',
    thankContact: 'Wir schreiben Ihnen an',
    thankWa: 'Uns auf WhatsApp schreiben',
    invalidLink: 'Dieser Link ist ungültig oder abgelaufen.',
    alreadyTitle: 'Danke! Brief erhalten.',
    alreadySubtitle: 'Ihre Website wird vorbereitet.',
    loadingText: 'Lädt...',
  },

  cs: {
    heading: 'Brief pro váš web',
    subtitle: 'Vyplňte brief • Váš web bude hotový do 48 hodin',
    s1Title: 'O vašem podniku',
    labelBizName: 'Název podniku',
    labelAddress: 'Adresa',
    phAddress: 'Hlavní 15, Praha',
    labelEmail: 'Email',
    labelHours: 'Pracovní hodiny',
    phHours: 'Po–Pá 8:00–18:00, So 9:00–14:00',
    s2Title: 'Služby a ceny',
    labelYourServices: 'Vybrané sekce',
    labelAdditional: 'Další služby nebo ceník',
    phAdditional: 'Napište další služby, ceny, speciální nabídky...',
    labelPriceList: 'Nahrát ceník',
    hintPriceList: 'PDF nebo fotka',
    dragPriceList: 'Přetáhněte ceník nebo klikněte',
    s3Title: 'Styl vašeho webu',
    labelPalette: 'Barevná paleta',
    labelHero: 'Styl hlavní obrazovky',
    labelMood: 'Nálada webu',
    palettes: {
      dark: 'Tmavý prémiový',
      light: 'Čistý světlý',
      warm: 'Teplý útulný',
      professional: 'Profesionální',
      natural: 'Přírodní',
      custom: 'Podle vašeho vkusu',
    },
    heros: {
      fullscreen: 'Celá obrazovka',
      split: 'Rozdělené (text + obrázek)',
      centered: 'Centrovaný',
    },
    moods: {
      modern: '🔲 Moderní minimalistický',
      cozy: '🏠 Teplý a útulný',
      strict: '👔 Přísně profesionální',
    },
    s4Title: 'Fotky a logo',
    labelLogo: 'Logo',
    dragLogo: 'Přetáhněte logo nebo klikněte',
    hintLogo: 'PNG, JPG, SVG, WebP',
    labelPhotos: 'Fotky podniku',
    dragPhotos: 'Přetáhněte fotky nebo klikněte',
    hintPhotos: 'Nahrajte 5–10 fotek vašeho podniku',
    photoHintByType: photoHintCs,
    hintMaxPhotos: 'Max 20 fotek',
    s5Title: 'Doplňující informace',
    labelInstagram: 'Instagram',
    phInstagram: '@vasafirma',
    labelFacebook: 'Facebook',
    phFacebook: 'facebook.com/vasafirma',
    labelReference: 'Web, který se vám líbí',
    phReference: 'https://...',
    labelWishes: 'Jakákoli přání',
    phWishes: 'Řekněte nám, co je pro vás důležité...',
    submit: 'Odeslat brief →',
    submitting: 'Odesílá se...',
    uploading: 'Nahrávám...',
    uploadError: 'Chyba nahrávání',
    deletePhoto: 'Odstranit',
    thankTitle: 'Děkujeme! Brief byl přijat.',
    thankSubtitle: 'Váš web bude hotový do 24–48 hodin.',
    thankContact: 'Napíšeme vám na',
    thankWa: 'Napsat nám přes WhatsApp',
    invalidLink: 'Odkaz není platný nebo vypršel.',
    alreadyTitle: 'Děkujeme! Brief byl přijat.',
    alreadySubtitle: 'Váš web je v přípravě.',
    loadingText: 'Načítá se...',
  },

  uk: {
    heading: 'Бриф для вашого сайту',
    subtitle: 'Заповніть бриф • Ваш сайт буде готовий через 48 годин',
    s1Title: 'Про ваш бізнес',
    labelBizName: 'Назва бізнесу',
    labelAddress: 'Адреса',
    phAddress: 'вул. Головна 15, Братислава',
    labelEmail: 'Email',
    labelHours: 'Години роботи',
    phHours: 'Пн–Пт 8:00–18:00, Сб 9:00–14:00',
    s2Title: 'Послуги та ціни',
    labelYourServices: 'Вибрані секції',
    labelAdditional: 'Додаткові послуги або прайс',
    phAdditional: 'Напишіть додаткові послуги, ціни, спеціальні пропозиції...',
    labelPriceList: 'Завантажити прайс-лист',
    hintPriceList: 'PDF або фото',
    dragPriceList: 'Перетягніть прайс або натисніть',
    s3Title: 'Стиль вашого сайту',
    labelPalette: 'Кольорова палітра',
    labelHero: 'Стиль головного екрану',
    labelMood: 'Настрій сайту',
    palettes: {
      dark: 'Темний преміум',
      light: 'Чистий світлий',
      warm: 'Теплий затишний',
      professional: 'Професійний',
      natural: 'Природний',
      custom: 'На ваш смак',
    },
    heros: {
      fullscreen: 'Повний екран',
      split: 'Розділений (текст + зображення)',
      centered: 'Центрований',
    },
    moods: {
      modern: '🔲 Сучасний мінімалістичний',
      cozy: '🏠 Теплий та затишний',
      strict: '👔 Суворий професійний',
    },
    s4Title: 'Фото та логотип',
    labelLogo: 'Логотип',
    dragLogo: 'Перетягніть логотип або натисніть',
    hintLogo: 'PNG, JPG, SVG, WebP',
    labelPhotos: 'Фото бізнесу',
    dragPhotos: 'Перетягніть фото або натисніть',
    hintPhotos: 'Завантажте 5–10 фото вашого бізнесу',
    photoHintByType: photoHintUk,
    hintMaxPhotos: 'Максимум 20 фото',
    s5Title: 'Додатково',
    labelInstagram: 'Instagram',
    phInstagram: '@vashbiznes',
    labelFacebook: 'Facebook',
    phFacebook: 'facebook.com/vashbiznes',
    labelReference: 'Сайт, який вам подобається',
    phReference: 'https://...',
    labelWishes: 'Будь-які побажання',
    phWishes: 'Розкажіть, що важливо для вас...',
    submit: 'Відправити бриф →',
    submitting: 'Відправляємо...',
    uploading: 'Завантажую...',
    uploadError: 'Помилка завантаження',
    deletePhoto: 'Видалити',
    thankTitle: 'Дякуємо! Бриф отримано.',
    thankSubtitle: 'Ваш сайт буде готовий через 24–48 годин.',
    thankContact: 'Ми напишемо вам на',
    thankWa: 'Написати нам у WhatsApp',
    invalidLink: 'Посилання недійсне або застаріло.',
    alreadyTitle: 'Дякуємо! Бриф отримано.',
    alreadySubtitle: 'Ваш сайт готується.',
    loadingText: 'Завантажується...',
  },

  ru: {
    heading: 'Бриф для вашего сайта',
    subtitle: 'Заполните бриф • Ваш сайт будет готов через 48 часов',
    s1Title: 'О вашем бизнесе',
    labelBizName: 'Название бизнеса',
    labelAddress: 'Адрес',
    phAddress: 'ул. Главная 15, Братислава',
    labelEmail: 'Email',
    labelHours: 'Время работы',
    phHours: 'Пн–Пт 8:00–18:00, Сб 9:00–14:00',
    s2Title: 'Услуги и цены',
    labelYourServices: 'Выбранные секции',
    labelAdditional: 'Дополнительные услуги или прайс',
    phAdditional: 'Напишите дополнительные услуги, цены, специальные предложения...',
    labelPriceList: 'Загрузить прайс-лист',
    hintPriceList: 'PDF или фото',
    dragPriceList: 'Перетащите прайс или нажмите',
    s3Title: 'Стиль вашего сайта',
    labelPalette: 'Цветовая палитра',
    labelHero: 'Стиль главного экрана',
    labelMood: 'Настроение сайта',
    palettes: {
      dark: 'Тёмный премиум',
      light: 'Чистый светлый',
      warm: 'Тёплый уютный',
      professional: 'Профессиональный',
      natural: 'Натуральный',
      custom: 'На ваш вкус',
    },
    heros: {
      fullscreen: 'Полный экран',
      split: 'Разделённый (текст + изображение)',
      centered: 'Центрированный',
    },
    moods: {
      modern: '🔲 Современный минималистичный',
      cozy: '🏠 Тёплый и уютный',
      strict: '👔 Строгий профессиональный',
    },
    s4Title: 'Фото и логотип',
    labelLogo: 'Логотип',
    dragLogo: 'Перетащите логотип или нажмите',
    hintLogo: 'PNG, JPG, SVG, WebP',
    labelPhotos: 'Фото бизнеса',
    dragPhotos: 'Перетащите фото или нажмите',
    hintPhotos: 'Загрузите 5–10 фото вашего бизнеса',
    photoHintByType: photoHintRu,
    hintMaxPhotos: 'Максимум 20 фото',
    s5Title: 'Дополнительно',
    labelInstagram: 'Instagram',
    phInstagram: '@vashbiznes',
    labelFacebook: 'Facebook',
    phFacebook: 'facebook.com/vashbiznes',
    labelReference: 'Сайт, который вам нравится',
    phReference: 'https://...',
    labelWishes: 'Любые пожелания',
    phWishes: 'Расскажите что важно для вас...',
    submit: 'Отправить бриф →',
    submitting: 'Отправляем...',
    uploading: 'Загрузка...',
    uploadError: 'Ошибка загрузки',
    deletePhoto: 'Удалить',
    thankTitle: 'Спасибо! Бриф получен.',
    thankSubtitle: 'Ваш сайт будет готов через 24–48 часов.',
    thankContact: 'Мы напишем вам на',
    thankWa: 'Написать нам в WhatsApp',
    invalidLink: 'Ссылка недействительна или устарела.',
    alreadyTitle: 'Спасибо! Бриф получен.',
    alreadySubtitle: 'Ваш сайт готовится.',
    loadingText: 'Загрузка...',
  },
};

export function getBriefT(lang: string): BriefT {
  return BRIEF_TRANSLATIONS[lang] ?? BRIEF_TRANSLATIONS.en;
}
