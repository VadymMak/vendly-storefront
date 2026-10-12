import { RegisterForm } from './RegisterForm';

// Read the Turnstile key at request time so it can be set in the server .env without a rebuild
export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return <RegisterForm turnstileSiteKey={process.env.TURNSTILE_SITE_KEY ?? null} />;
}
