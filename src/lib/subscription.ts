import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function getSubscriptionData() {
  const session = await auth();
  if (!session?.user?.email) return null;

  return await prisma.subscription.findFirst({
    where: { user: { email: session.user.email } },
  });
}