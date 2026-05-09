import { getSubscriptionData } from '@/lib/subscription';

export default async function TestSubscriptionPage() {
  const subscription = await getSubscriptionData();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md text-center">
        <h1 className="text-2xl font-semibold text-gray-800">Subscription Status</h1>
        {subscription ? (
          <p className="mt-4 text-lg text-gray-600">
            Your current plan is: <span className="font-bold">{subscription.plan}</span>
          </p>
        ) : (
          <p className="mt-4 text-lg text-red-500">You do not have an active subscription.</p>
        )}
      </div>
    </div>
  );
}