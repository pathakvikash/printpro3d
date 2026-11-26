// Auth.js (next-auth v5) Google sign-in, JWT session, no database. Only emails in ADMIN_EMAILS get a session.
// Env: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET (read by Auth.js itself), ADMIN_EMAILS.
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { emailAllowed } from './lib/adminAuth.ts';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt' },
  trustHost: true, // Vercel sets the Host header; no fixed URL to configure
  pages: { error: '/admin' }, // a denied sign-in lands on /admin?error=AccessDenied
  callbacks: {
    signIn: ({ profile }) => emailAllowed(profile?.email, profile?.email_verified === true),
  },
});
