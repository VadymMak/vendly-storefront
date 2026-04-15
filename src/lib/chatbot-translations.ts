export interface ButtonItem {
  label: string;
  value: string;
}

export interface ChatTranslation {
  greeting: string;
  businessTypes: ButtonItem[];
  demoMessage: string;
  demoButton: string;
  likeButton: string;
  anotherButton: string;
  nameQuestion: string;
  servicesQuestion: string;
  styleQuestion: string;
  styleOptions: ButtonItem[];
  contactQuestion: string;
  confirmMessage: (data: {
    businessName: string;
    businessType: string;
    services: string;
    style: string;
  }) => string;
  confirmYes: string;
  confirmEdit: string;
  thankYou: (contact: string) => string;
  waButton: string;
  editWhat: string;
  editOptions: ButtonItem[];
}

export const CHATBOT_TRANSLATIONS: Record<string, ChatTranslation> = {
  sk: {
    greeting:
      'Ahoj! 👋 Som asistent VendShop. Pomôžem vám získať profesionálnu webstránku za 48 hodín. Aký typ podnikania máte?',
    businessTypes: [
      { label: '🍽️ Reštaurácia / Kaviareň', value: 'restaurant' },
      { label: '🔧 Autoservis / Opravovňa', value: 'auto' },
      { label: '💈 Salón krásy', value: 'beauty' },
      { label: '🦷 Medicína / Klinika', value: 'medical' },
      { label: '🧘 Fitness / Yoga', value: 'fitness' },
      { label: '🛍️ Obchod / E-shop', value: 'ecommerce' },
      { label: '📸 Fotograf', value: 'photography' },
      { label: '🍺 Bar / Lounge', value: 'bar' },
      { label: '✏️ Iné', value: 'other' },
    ],
    demoMessage: 'Výborne! Takto môže vyzerať vaša webstránka:',
    demoButton: '🔗 Pozrieť ukážku',
    likeButton: '👍 Páči sa, pokračovať',
    anotherButton: '🔄 Ukázať iný príklad',
    nameQuestion: 'Ako sa volá váš biznis?',
    servicesQuestion: 'Aké 3–5 hlavných služieb alebo produktov chcete ukázať na webstránke?',
    styleQuestion: 'Aký štýl sa vám páči?',
    styleOptions: [
      { label: '🌙 Tmavý (premium)', value: 'dark' },
      { label: '☀️ Svetlý (čistý)', value: 'light' },
      { label: '🍂 Teplý (útulný)', value: 'warm' },
      { label: '🎨 Podľa vášho vkusu', value: 'auto' },
    ],
    contactQuestion:
      'Výborne! Aby sme vám poslali hotovú webstránku — zadajte váš WhatsApp alebo telefón:',
    confirmMessage: ({ businessName, businessType, services, style }) =>
      `Skontrolujte údaje:\n• Biznis: ${businessName}\n• Typ: ${businessType}\n• Služby: ${services}\n• Štýl: ${style}\n\nVšetko správne?`,
    confirmYes: '✅ Áno, všetko správne',
    confirmEdit: '✏️ Chcem opraviť',
    thankYou: (contact) =>
      `Ďakujeme! 🎉 Vaša webstránka bude hotová za 24–48 hodín. Pošleme odkaz na ${contact}.\n\n💡 Medzitým môžete pripraviť:\n• Logo (ak máte)\n• 6–10 fotiek biznisu\n• Texty (o nás, kontakty)\n\nPošlite cez WhatsApp kedy vám vyhovuje.`,
    waButton: '💬 Napísať cez WhatsApp',
    editWhat: 'Čo chcete zmeniť?',
    editOptions: [
      { label: 'Názov', value: 'name' },
      { label: 'Služby', value: 'services' },
      { label: 'Štýl', value: 'style' },
      { label: 'Kontakt', value: 'contact' },
    ],
  },

  en: {
    greeting:
      "Hello! 👋 I'm the VendShop assistant. I'll help you get a professional website in 48 hours. What type of business do you have?",
    businessTypes: [
      { label: '🍽️ Restaurant / Cafe', value: 'restaurant' },
      { label: '🔧 Auto Service / Repair', value: 'auto' },
      { label: '💈 Beauty Salon', value: 'beauty' },
      { label: '🦷 Medical / Clinic', value: 'medical' },
      { label: '🧘 Fitness / Yoga', value: 'fitness' },
      { label: '🛍️ Shop / E-commerce', value: 'ecommerce' },
      { label: '📸 Photographer', value: 'photography' },
      { label: '🍺 Bar / Lounge', value: 'bar' },
      { label: '✏️ Other', value: 'other' },
    ],
    demoMessage: "Great! Here's how your website could look:",
    demoButton: '🔗 View example',
    likeButton: '👍 Looks good, continue',
    anotherButton: '🔄 Show another example',
    nameQuestion: 'What is your business name?',
    servicesQuestion: 'What 3–5 main services or products would you like to show on the website?',
    styleQuestion: 'Which style do you prefer?',
    styleOptions: [
      { label: '🌙 Dark (premium)', value: 'dark' },
      { label: '☀️ Light (clean)', value: 'light' },
      { label: '🍂 Warm (cozy)', value: 'warm' },
      { label: '🎨 Your choice', value: 'auto' },
    ],
    contactQuestion:
      'Great! To send you the finished website — enter your WhatsApp or phone number:',
    confirmMessage: ({ businessName, businessType, services, style }) =>
      `Review your details:\n• Business: ${businessName}\n• Type: ${businessType}\n• Services: ${services}\n• Style: ${style}\n\nIs everything correct?`,
    confirmYes: '✅ Yes, everything correct',
    confirmEdit: '✏️ I want to edit',
    thankYou: (contact) =>
      `Thank you! 🎉 Your website will be ready in 24–48 hours. We'll send the link to ${contact}.\n\n💡 In the meantime, prepare:\n• Logo (if you have one)\n• 6–10 photos of your business\n• Texts (about us, contacts)\n\nSend via WhatsApp when ready.`,
    waButton: '💬 Message on WhatsApp',
    editWhat: 'What would you like to change?',
    editOptions: [
      { label: 'Name', value: 'name' },
      { label: 'Services', value: 'services' },
      { label: 'Style', value: 'style' },
      { label: 'Contact', value: 'contact' },
    ],
  },

  de: {
    greeting:
      'Hallo! 👋 Ich bin der VendShop-Assistent. Ich helfe Ihnen, in 48 Stunden eine professionelle Website zu bekommen. Welche Art von Unternehmen haben Sie?',
    businessTypes: [
      { label: '🍽️ Restaurant / Café', value: 'restaurant' },
      { label: '🔧 KFZ-Werkstatt / Reparatur', value: 'auto' },
      { label: '💈 Schönheitssalon', value: 'beauty' },
      { label: '🦷 Medizin / Klinik', value: 'medical' },
      { label: '🧘 Fitness / Yoga', value: 'fitness' },
      { label: '🛍️ Geschäft / E-Shop', value: 'ecommerce' },
      { label: '📸 Fotograf', value: 'photography' },
      { label: '🍺 Bar / Lounge', value: 'bar' },
      { label: '✏️ Sonstiges', value: 'other' },
    ],
    demoMessage: 'Ausgezeichnet! So könnte Ihre Website aussehen:',
    demoButton: '🔗 Beispiel ansehen',
    likeButton: '👍 Gefällt mir, weiter',
    anotherButton: '🔄 Anderes Beispiel zeigen',
    nameQuestion: 'Wie heißt Ihr Unternehmen?',
    servicesQuestion:
      'Welche 3–5 Hauptleistungen oder Produkte möchten Sie auf der Website zeigen?',
    styleQuestion: 'Welchen Stil bevorzugen Sie?',
    styleOptions: [
      { label: '🌙 Dunkel (premium)', value: 'dark' },
      { label: '☀️ Hell (sauber)', value: 'light' },
      { label: '🍂 Warm (gemütlich)', value: 'warm' },
      { label: '🎨 Nach Ihrem Geschmack', value: 'auto' },
    ],
    contactQuestion:
      'Ausgezeichnet! Um Ihnen die fertige Website zu schicken — geben Sie Ihren WhatsApp oder Ihre Telefonnummer an:',
    confirmMessage: ({ businessName, businessType, services, style }) =>
      `Überprüfen Sie Ihre Daten:\n• Unternehmen: ${businessName}\n• Typ: ${businessType}\n• Leistungen: ${services}\n• Stil: ${style}\n\nIst alles korrekt?`,
    confirmYes: '✅ Ja, alles korrekt',
    confirmEdit: '✏️ Ich möchte korrigieren',
    thankYou: (contact) =>
      `Danke! 🎉 Ihre Website wird in 24–48 Stunden fertig sein. Wir senden den Link an ${contact}.\n\n💡 In der Zwischenzeit können Sie vorbereiten:\n• Logo (falls vorhanden)\n• 6–10 Fotos Ihres Unternehmens\n• Texte (über uns, Kontakte)\n\nSenden Sie über WhatsApp, wenn es Ihnen passt.`,
    waButton: '💬 WhatsApp schreiben',
    editWhat: 'Was möchten Sie ändern?',
    editOptions: [
      { label: 'Name', value: 'name' },
      { label: 'Leistungen', value: 'services' },
      { label: 'Stil', value: 'style' },
      { label: 'Kontakt', value: 'contact' },
    ],
  },

  cs: {
    greeting:
      'Ahoj! 👋 Jsem asistent VendShop. Pomůžu vám získat profesionální web za 48 hodin. Jaký typ podnikání máte?',
    businessTypes: [
      { label: '🍽️ Restaurace / Kavárna', value: 'restaurant' },
      { label: '🔧 Autoservis / Opravna', value: 'auto' },
      { label: '💈 Salón krásy', value: 'beauty' },
      { label: '🦷 Medicína / Klinika', value: 'medical' },
      { label: '🧘 Fitness / Jóga', value: 'fitness' },
      { label: '🛍️ Obchod / E-shop', value: 'ecommerce' },
      { label: '📸 Fotograf', value: 'photography' },
      { label: '🍺 Bar / Lounge', value: 'bar' },
      { label: '✏️ Jiné', value: 'other' },
    ],
    demoMessage: 'Skvěle! Takto může vypadat váš web:',
    demoButton: '🔗 Zobrazit ukázku',
    likeButton: '👍 Líbí se, pokračovat',
    anotherButton: '🔄 Ukázat jiný příklad',
    nameQuestion: 'Jak se jmenuje vaše firma?',
    servicesQuestion: 'Jaké 3–5 hlavních služeb nebo produktů chcete ukázat na webu?',
    styleQuestion: 'Jaký styl se vám líbí?',
    styleOptions: [
      { label: '🌙 Tmavý (premium)', value: 'dark' },
      { label: '☀️ Světlý (čistý)', value: 'light' },
      { label: '🍂 Teplý (útulný)', value: 'warm' },
      { label: '🎨 Podle vašeho vkusu', value: 'auto' },
    ],
    contactQuestion:
      'Skvěle! Abychom vám poslali hotový web — zadejte váš WhatsApp nebo telefon:',
    confirmMessage: ({ businessName, businessType, services, style }) =>
      `Zkontrolujte údaje:\n• Firma: ${businessName}\n• Typ: ${businessType}\n• Služby: ${services}\n• Styl: ${style}\n\nVše správně?`,
    confirmYes: '✅ Ano, vše správně',
    confirmEdit: '✏️ Chci opravit',
    thankYou: (contact) =>
      `Děkujeme! 🎉 Váš web bude hotový za 24–48 hodin. Pošleme odkaz na ${contact}.\n\n💡 Mezitím můžete připravit:\n• Logo (pokud máte)\n• 6–10 fotek firmy\n• Texty (o nás, kontakty)\n\nPošlete přes WhatsApp, kdy vám to vyhovuje.`,
    waButton: '💬 Napsat přes WhatsApp',
    editWhat: 'Co chcete změnit?',
    editOptions: [
      { label: 'Název', value: 'name' },
      { label: 'Služby', value: 'services' },
      { label: 'Styl', value: 'style' },
      { label: 'Kontakt', value: 'contact' },
    ],
  },

  uk: {
    greeting:
      'Привіт! 👋 Я асистент VendShop. Допоможу вам отримати професійний сайт за 48 годин. Який тип бізнесу у вас?',
    businessTypes: [
      { label: '🍽️ Ресторан / Кафе', value: 'restaurant' },
      { label: '🔧 Автосервіс / Ремонт', value: 'auto' },
      { label: '💈 Салон краси', value: 'beauty' },
      { label: '🦷 Медицина / Клініка', value: 'medical' },
      { label: '🧘 Фітнес / Йога', value: 'fitness' },
      { label: '🛍️ Магазин / E-shop', value: 'ecommerce' },
      { label: '📸 Фотограф', value: 'photography' },
      { label: '🍺 Бар / Лаунж', value: 'bar' },
      { label: '✏️ Інше', value: 'other' },
    ],
    demoMessage: 'Чудово! Ось як може виглядати ваш сайт:',
    demoButton: '🔗 Переглянути приклад',
    likeButton: '👍 Подобається, продовжити',
    anotherButton: '🔄 Показати інший приклад',
    nameQuestion: 'Як називається ваш бізнес?',
    servicesQuestion: 'Які 3–5 головних послуг або продуктів ви хочете показати на сайті?',
    styleQuestion: 'Який стиль вам подобається?',
    styleOptions: [
      { label: '🌙 Темний (premium)', value: 'dark' },
      { label: '☀️ Світлий (чистий)', value: 'light' },
      { label: '🍂 Теплий (затишний)', value: 'warm' },
      { label: '🎨 На ваш смак', value: 'auto' },
    ],
    contactQuestion:
      'Чудово! Щоб надіслати вам готовий сайт — вкажіть ваш WhatsApp або телефон:',
    confirmMessage: ({ businessName, businessType, services, style }) =>
      `Перевірте дані:\n• Бізнес: ${businessName}\n• Тип: ${businessType}\n• Послуги: ${services}\n• Стиль: ${style}\n\nВсе вірно?`,
    confirmYes: '✅ Так, все вірно',
    confirmEdit: '✏️ Хочу виправити',
    thankYou: (contact) =>
      `Дякуємо! 🎉 Ваш сайт буде готовий за 24–48 годин. Надішлемо посилання на ${contact}.\n\n💡 Поки що можете підготувати:\n• Логотип (якщо є)\n• 6–10 фото бізнесу\n• Тексти (про нас, контакти)\n\nНадішліть через WhatsApp коли буде зручно.`,
    waButton: '💬 Написати у WhatsApp',
    editWhat: 'Що хочете змінити?',
    editOptions: [
      { label: 'Назва', value: 'name' },
      { label: 'Послуги', value: 'services' },
      { label: 'Стиль', value: 'style' },
      { label: 'Контакт', value: 'contact' },
    ],
  },

  ru: {
    greeting:
      'Привет! 👋 Я помощник VendShop. Помогу получить профессиональный сайт за 48 часов. Какой тип бизнеса у вас?',
    businessTypes: [
      { label: '🍽️ Ресторан / Кафе', value: 'restaurant' },
      { label: '🔧 Автосервис / Ремонт', value: 'auto' },
      { label: '💈 Салон красоты', value: 'beauty' },
      { label: '🦷 Медицина / Клиника', value: 'medical' },
      { label: '🧘 Фитнес / Йога', value: 'fitness' },
      { label: '🛍️ Магазин / E-shop', value: 'ecommerce' },
      { label: '📸 Фотограф', value: 'photography' },
      { label: '🍺 Бар / Лаунж', value: 'bar' },
      { label: '✏️ Другое', value: 'other' },
    ],
    demoMessage: 'Отлично! Вот как может выглядеть ваш сайт:',
    demoButton: '🔗 Посмотреть пример',
    likeButton: '👍 Нравится, продолжить',
    anotherButton: '🔄 Показать другой пример',
    nameQuestion: 'Как называется ваш бизнес?',
    servicesQuestion: 'Какие 3–5 главных услуг или продуктов вы хотите показать на сайте?',
    styleQuestion: 'Какой стиль вам нравится?',
    styleOptions: [
      { label: '🌙 Тёмный (premium)', value: 'dark' },
      { label: '☀️ Светлый (чистый)', value: 'light' },
      { label: '🍂 Тёплый (уютный)', value: 'warm' },
      { label: '🎨 На ваш вкус', value: 'auto' },
    ],
    contactQuestion:
      'Отлично! Чтобы отправить вам готовый сайт — укажите ваш WhatsApp или телефон:',
    confirmMessage: ({ businessName, businessType, services, style }) =>
      `Проверьте данные:\n• Бизнес: ${businessName}\n• Тип: ${businessType}\n• Услуги: ${services}\n• Стиль: ${style}\n\nВсё верно?`,
    confirmYes: '✅ Да, всё верно',
    confirmEdit: '✏️ Хочу исправить',
    thankYou: (contact) =>
      `Спасибо! 🎉 Ваш сайт будет готов через 24–48 часов. Отправим ссылку на ${contact}.\n\n💡 Пока можете подготовить:\n• Логотип (если есть)\n• 6–10 фото бизнеса\n• Тексты (о нас, контакты)\n\nОтправьте через WhatsApp когда будет удобно.`,
    waButton: '💬 Написать в WhatsApp',
    editWhat: 'Что хотите изменить?',
    editOptions: [
      { label: 'Название', value: 'name' },
      { label: 'Услуги', value: 'services' },
      { label: 'Стиль', value: 'style' },
      { label: 'Контакт', value: 'contact' },
    ],
  },
};
