// Auth.js (next-auth v5) Google sign-in, JWT session, no database. Any verified Google email gets a session (customers);
// only ADMIN_EMAILS may open the admin pages and APIs (checked there, not here).
// Env: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET (read by Auth.js itself), ADMIN_EMAILS.
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { emailAllowed } from './lib/adminAuth.ts';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt' },
  trustHost: true, // Vercel sets the Host header; no fixed URL to configure
  callbacks: {
    signIn: ({ profile }) => profile?.email_verified === true && !!profile.email,
    // without a DB adapter Auth.js puts a fresh random UUID in token.sub each sign-in; use Google's stable account id instead
    jwt: ({ token, account }) => {
      if (account?.provider === 'google' && account.providerAccountId) token.sub = account.providerAccountId;
      return token;
    },
    // the session carries the Google sub (id) and whether the email is an admin; the server re-checks on every admin request
    session: ({ session, token }) => {
      const u = session.user as typeof session.user & { id?: string; admin?: boolean };
      u.id = token.sub ?? '';
      u.admin = emailAllowed(u.email, undefined);
      return session;
    },
  },
});
