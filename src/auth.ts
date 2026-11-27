// Auth.js (next-auth v5) Google sign-in, JWT session, no database. Any verified Google email gets a session (customers);
// only ADMIN_EMAILS may open the admin pages and APIs (checked there, not here).
// Env: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET (read by Auth.js itself), ADMIN_EMAILS.
// Second way in: the 'orrery' provider, used only by /sso. It accepts a handoff token that Orrery signed with ORRERY_APP_SECRET
// for an email Orrery already verified with Google. Such sessions are marked via:'orrery' and never count as admin.
import { createHash } from 'node:crypto';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { emailAllowed } from './lib/adminAuth.ts';
import { acceptHandoff } from './lib/orrery.ts';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      id: 'orrery',
      name: 'Orrery',
      credentials: { token: {} },
      // verifies the signature, aud, iss, expiry and purpose, and burns the single-use jti; no account is created, the session is just a cookie
      authorize: (c) => {
        const email = typeof c?.token === 'string' ? acceptHandoff(c.token) : null;
        // a hash keeps the id a valid store key (account.ts wants [A-Za-z0-9]{1,64}); Google's numeric id is not known here
        return email ? { id: `o${createHash('sha256').update(email).digest('hex').slice(0, 40)}`, email, name: email.split('@')[0] } : null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  trustHost: true, // Vercel sets the Host header; no fixed URL to configure
  callbacks: {
    signIn: ({ account, profile }) => account?.provider === 'orrery' || (profile?.email_verified === true && !!profile.email),
    // without a DB adapter Auth.js puts a fresh random UUID in token.sub each sign-in; use Google's stable account id instead
    jwt: ({ token, account }) => {
      if (account?.provider === 'google' && account.providerAccountId) token.sub = account.providerAccountId;
      if (account?.provider === 'orrery') token.via = 'orrery';
      return token;
    },
    // the session carries the Google sub (id) and whether the email is an admin; the server re-checks on every admin request
    session: ({ session, token }) => {
      const u = session.user as typeof session.user & { id?: string; admin?: boolean; via?: string };
      u.id = token.sub ?? '';
      u.via = token.via === 'orrery' ? 'orrery' : undefined;
      u.admin = u.via !== 'orrery' && emailAllowed(u.email, undefined); // the handoff never grants admin
      return session;
    },
  },
});
