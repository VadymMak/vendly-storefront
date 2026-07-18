import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from './db';
import { SUPERUSER_EMAILS } from './credits';

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase();
        const password = credentials.password as string;

        // ── Superuser bypass ──────────────────────────────────────────────
        // Superusers login with ADMIN_PASSWORD — no DB record required.
        const superuserPassword = process.env.ADMIN_PASSWORD;
        if (
          superuserPassword &&
          (SUPERUSER_EMAILS as readonly string[]).includes(email) &&
          password === superuserPassword
        ) {
          const user = await db.user.upsert({
            where: { email },
            update: {},
            create: { email, name: 'Admin' },
          });
          return { id: user.id, email: user.email, name: user.name };
        }
        // ─────────────────────────────────────────────────────────────────

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
