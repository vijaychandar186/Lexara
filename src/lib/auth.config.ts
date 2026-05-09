import { NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

export const authConfig = {
  providers: [GitHub, Google],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login'
  },
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string ?? token.sub ?? '';
      }
      return session;
    }
  }
} satisfies NextAuthConfig;

export default authConfig;