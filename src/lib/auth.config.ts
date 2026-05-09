import { NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

export const authConfig = {
  providers: [GitHub, Google],
  pages: {
    signIn: '/login'
  },
  callbacks: {
    async signIn() {
      return true;
    },
    async session({ session }) {
      return session;
    }
  }
} satisfies NextAuthConfig;

export default authConfig;