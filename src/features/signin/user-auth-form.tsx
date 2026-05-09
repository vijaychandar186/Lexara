'use client';
import GithubSignInButton from './github-auth-button';
import GoogleSignInButton from './google-auth-button';

export default function UserAuthForm() {
  return (
    <>
      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-background px-2 text-muted-foreground'>
            Sign in with
          </span>
        </div>
      </div>
      <GithubSignInButton />
      <GoogleSignInButton />
    </>
  );
}