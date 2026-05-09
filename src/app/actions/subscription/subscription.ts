'use server';

import { razorpay } from '@/lib/razorpay';
import { prisma } from '@/lib/prisma';
import { SubscriptionPlan } from '@prisma/client';
import { auth } from '@/lib/auth';

interface RazorpaySubscriptionCreateParams {
  plan_id: string;
  customer_notify: 0 | 1;
  total_count: number;
  quantity: number;
  notes: {
    userId: string;
    userEmail: string;
    plan: string;
  };
}

// Define a type for the expected Razorpay subscription response
interface RazorpaySubscription {
  id: string;
  status: string;
  plan_id: string;
  // Additional properties as needed
}

/**
 * Check the current subscription status for the logged-in user.
 * If no record is found, the user is assumed to be on the FREE plan.
 */
export async function checkSubscriptionStatus(): Promise<SubscriptionPlan> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  try {
    // Get user's subscription record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user.subscription?.plan || SubscriptionPlan.FREE;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    throw new Error('Failed to check subscription status');
  }
}

/**
 * Create a new Razorpay subscription.
 * The user's plan is not upgraded until payment is confirmed.
 */
export async function createSubscription(
  planType: 'PRO' | 'PREMIUM'
): Promise<{ subscription: RazorpaySubscription }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  try {
    // Get the user record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prevent creating a new subscription if the user already has a non-FREE plan
    if (user.subscription && user.subscription.plan !== SubscriptionPlan.FREE) {
      throw new Error('User already has an active subscription. Please cancel first before upgrading.');
    }

    // Determine the Razorpay plan ID based on the plan type
    const planId =
      planType === 'PRO'
        ? process.env.RAZORPAY_PRO_PLAN_ID
        : process.env.RAZORPAY_PREMIUM_PLAN_ID;

    if (!planId) {
      throw new Error(`${planType} plan ID not configured`);
    }

    // Build the parameters for Razorpay subscription creation
    const subscriptionParams: RazorpaySubscriptionCreateParams = {
      plan_id: planId,
      customer_notify: 1,
      total_count: 12, // 12 months subscription
      quantity: 1,
      notes: {
        userId: user.id,
        userEmail: user.email || '',
        plan: planType
      }
    };

    // Create the subscription with Razorpay
    const razorpaySubscription = (await razorpay.subscriptions.create(subscriptionParams)) as RazorpaySubscription;

    // Save (or update) the subscription record with the plan remaining FREE until confirmed.
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        razorpayId: razorpaySubscription.id
        // Note: plan is not updated here.
      },
      create: {
        userId: user.id,
        razorpayId: razorpaySubscription.id,
        plan: SubscriptionPlan.FREE // remains FREE until confirmed
      }
    });

    return { subscription: razorpaySubscription };
  } catch (error) {
    console.error('Subscription creation failed:', error);
    throw new Error('Failed to create subscription');
  }
}

/**
 * Wait for the subscription status to become active or authenticated.
 * Retries up to `maxRetries` times with a delay of `delayMs` between attempts.
 */
async function waitForActiveStatus(
  subscriptionId: string,
  maxRetries = 5,
  delayMs = 3000
): Promise<RazorpaySubscription> {
  for (let i = 0; i < maxRetries; i++) {
    const razorpaySubscription = (await razorpay.subscriptions.fetch(subscriptionId)) as RazorpaySubscription;
    if (['active', 'authenticated'].includes(razorpaySubscription.status)) {
      return razorpaySubscription;
    }
    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('Subscription not active after waiting');
}

/**
 * Confirm the subscription payment.
 * The user's plan is upgraded only if the Razorpay subscription status is "active" or "authenticated".
 */
export async function confirmSubscription(
  paymentId: string,
  subscriptionId: string
): Promise<{ plan: SubscriptionPlan }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  try {
    // Retrieve the user and their subscription record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (
      !user.subscription?.razorpayId ||
      user.subscription.razorpayId !== subscriptionId
    ) {
      throw new Error('Invalid subscription');
    }

    // Poll for active status
    const razorpaySubscription = await waitForActiveStatus(subscriptionId);

    // Determine the plan type from the Razorpay plan ID
    let planType: SubscriptionPlan;
    if (razorpaySubscription.plan_id === process.env.RAZORPAY_PRO_PLAN_ID) {
      planType = SubscriptionPlan.PRO;
    } else if (razorpaySubscription.plan_id === process.env.RAZORPAY_PREMIUM_PLAN_ID) {
      planType = SubscriptionPlan.PREMIUM;
    } else {
      throw new Error('Invalid plan type');
    }

    // Update the user's subscription plan in the database
    const updatedSubscription = await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        plan: planType
      }
    });

    return { plan: updatedSubscription.plan };
  } catch (error) {
    console.error('Subscription confirmation failed:', error);
    throw new Error('Failed to confirm subscription');
  }
}

/**
 * Cancel the user's subscription.
 * Calls Razorpay to cancel the subscription and resets the user's plan to FREE.
 */
export async function cancelSubscription() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  try {
    // Retrieve the user and their subscription record
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.subscription?.razorpayId) {
      throw new Error('No active subscription found');
    }

    // Cancel the subscription via Razorpay
    await razorpay.subscriptions.cancel(user.subscription.razorpayId);

    // Update the subscription record in the database
    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        plan: SubscriptionPlan.FREE,
        razorpayId: null
      }
    });

    return { message: 'Subscription cancelled successfully' };
  } catch (error) {
    console.error('Subscription cancellation failed:', error);
    throw new Error('Failed to cancel subscription');
  }
}