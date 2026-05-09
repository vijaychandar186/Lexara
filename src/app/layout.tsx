import { auth } from '@/lib/auth';
import Providers from '@/components/Providers';
import Navbar from '@/components/Navbar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, constructMetadata } from '@/lib/utils'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata = constructMetadata()

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" className="light">
      <body
        className={cn(
          'min-h-screen font-sans antialiased grainy',
          inter.className
        )}
      >
        <Providers session={session}>
          <Toaster />
          <Navbar />
          <ScrollArea className="h-[calc(100vh-4rem)]">
            {children}
          </ScrollArea>
        </Providers>
      </body>
    </html>
  );
}