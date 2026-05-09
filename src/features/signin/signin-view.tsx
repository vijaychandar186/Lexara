import { Metadata } from 'next';
import Link from 'next/link';
import UserAuthForm from './user-auth-form';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Sign In - Lexara',
  description: 'Sign in to access the OCR functionalities.'
};

export default function SignInViewPage() {
  return (
    <div className='relative h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <Link
        href='/examples/authentication'
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute right-4 top-4 hidden md:right-8 md:top-8'
        )}
      >
        Login
      </Link>
      
      {/* Left Pane */}
      <div className='relative hidden h-full flex-col bg-muted p-10 dark:border-r lg:flex'>
        <div className='absolute inset-0 bg-zinc-900' />
        <div className='relative z-20 flex h-full items-center justify-center'>
          {/* Content can be added here if needed */}
        </div>
      </div>
      
      {/* Right Pane - Authentication */}
      <div className='flex h-full items-center p-4 lg:p-8'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]'>
          <div className='flex flex-col space-y-2 text-center'>
            <h1 className='text-2xl font-semibold tracking-tight'>
              Sign In to Lexara
            </h1>
            <p className='text-sm text-muted-foreground'>
              Use your favorite social account to continue
            </p>
          </div>
          <UserAuthForm />

          <p className='px-8 text-center text-sm text-muted-foreground'>
            By continuing, you agree to our{' '}
            <Link
              href='/terms'
              className='underline underline-offset-4 hover:text-primary'
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href='/privacy'
              className='underline underline-offset-4 hover:text-primary'
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
