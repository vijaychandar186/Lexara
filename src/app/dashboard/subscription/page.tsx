import { Metadata } from 'next';
import ClientSubscription from '@/features/subscription/subscription-view';
import { checkSubscriptionStatus } from '@/app/actions/subscription/subscription';

export const metadata: Metadata = {
  title: 'Dashboard | Subscription',
  description: 'Manage your subscription in the dashboard.'
};

export default async function SubscriptionPage() {
  // Fetch initial status on the server
  const initialPlan = await checkSubscriptionStatus();
  
  return (
    <ClientSubscription initialPlan={initialPlan} />
  );
}