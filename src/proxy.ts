import NextAuth from 'next-auth';
import authConfig from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    const url = req.url.replace(req.nextUrl.pathname, '/login');
    return Response.redirect(url);
  }
});

export const config = { matcher: ['/dashboard/:path*'] };