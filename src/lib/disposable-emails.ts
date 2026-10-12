// Known disposable / temporary inbox domains, rejected at sign-up (PROMPT-236).
// Not exhaustive — Turnstile + per-IP limit are the main defenses; this only
// removes the zero-effort path. Subdomains of listed domains are matched too.
const DISPOSABLE_DOMAINS = new Set([
  '0-mail.com', '10mail.org', '10minutemail.com', '10minutemail.net', '20minutemail.com',
  '33mail.com', 'anonaddy.me', 'binkmail.com', 'bobmail.info', 'burnermail.io',
  'byom.de', 'chacuo.net', 'crazymailing.com', 'deadaddress.com',
  'discard.email', 'discardmail.com', 'discardmail.de', 'disposableemailaddresses.com', 'dispostable.com',
  'dropmail.me', 'emailondeck.com', 'emailfake.com', 'emltmp.com', 'fakeinbox.com',
  'fakemail.net', 'fakemailgenerator.com', 'fexbox.org', 'getairmail.com', 'getnada.com',
  'grr.la', 'guerrillamail.biz', 'guerrillamail.com', 'guerrillamail.de', 'guerrillamail.info',
  'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com', 'harakirimail.com', 'inboxbear.com',
  'incognitomail.org', 'jetable.org', 'kurzepost.de', 'mail-temp.com', 'mail.tm',
  'mailcatch.com', 'maildrop.cc', 'mailinator.com', 'mailinator.net', 'mailinator2.com',
  'mailnesia.com', 'mailpoof.com', 'mailsac.com', 'mintemail.com', 'mohmal.com',
  'moakt.com', 'mytemp.email', 'nada.email', 'nowmymail.com', 'one-time.email',
  'pokemail.net', 'rootfest.net', 'sharklasers.com', 'spam4.me', 'spamavert.com',
  'spambog.com', 'spamex.com', 'spamgourmet.com', 'spaml.de', 'spamspot.com',
  'temp-mail.io', 'temp-mail.org', 'tempail.com', 'tempinbox.com', 'tempmail.com',
  'tempmail.dev', 'tempmail.net', 'tempmail.plus', 'tempmailo.com', 'tempr.email',
  'tmail.ws', 'tmpmail.net', 'tmpmail.org', 'trash-mail.com', 'trashmail.com',
  'trashmail.de', 'trashmail.io', 'trashmail.me', 'trashmail.net', 'trbvm.com',
  'wegwerfmail.de', 'wegwerfmail.net', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'zetmail.com',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return false;
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}
