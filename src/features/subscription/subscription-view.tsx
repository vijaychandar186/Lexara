'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  checkSubscriptionStatus,
  createSubscription,
  confirmSubscription,
  cancelSubscription
} from '@/app/actions/subscription/subscription';
import { SubscriptionPlan } from '@prisma/client';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { pricingItems } from '@/constants/pricing';

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: (response: RazorpayResponse) => Promise<void>;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay: {
      new (options: RazorpayOptions): RazorpayInstance;
    };
  }
}

interface ClientSubscriptionProps {
  initialPlan: SubscriptionPlan;
}

export default function ClientSubscription({ initialPlan }: ClientSubscriptionProps) {
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>(initialPlan);
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'PRO' | 'PREMIUM'>('PRO');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      setScriptLoaded(true);
    }
  }, []);

  useEffect(() => {
    const intervalId = setInterval(checkStatus, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const checkStatus = async () => {
    try {
      const plan = await checkSubscriptionStatus();
      setSubscriptionPlan(plan);
    } catch (error) {
      console.error('Failed to check status:', error);
      toast.error('Failed to check subscription status');
    }
  };

  const handleSubscribe = async (planType: 'PRO' | 'PREMIUM') => {
    if (!scriptLoaded) {
      toast.error('Payment gateway is loading. Please try again in a moment.', {
        action: {
          label: 'Refresh',
          onClick: () => window.location.reload()
        }
      });
      return;
    }

    if (subscriptionPlan !== SubscriptionPlan.FREE) {
      toast.error('Please cancel your current subscription before upgrading to a different plan', {
        action: {
          label: 'Cancel Current Plan',
          onClick: () => setShowCancelDialog(true)
        }
      });
      return;
    }

    setSelectedPlan(planType);
    setLoading(true);
    try {
      const response = await createSubscription(planType);
      const { subscription } = response;

      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
        subscription_id: subscription.id,
        name: 'Lexara',
        description: `${planType} Plan Subscription`,
        handler: async function (response: RazorpayResponse) {
          try {
            const result = await confirmSubscription(
              response.razorpay_payment_id,
              response.razorpay_subscription_id
            );
            setSubscriptionPlan(result.plan);
            toast.success(`Successfully upgraded to ${result.plan} plan!`);
          } catch (error) {
            console.error('Payment confirmation failed:', error);
            toast.error('Failed to confirm subscription');
            await checkStatus();
          }
        }
      });

      razorpay.open();
    } catch (error) {
      console.error('Subscription failed:', error);
      toast.error('Failed to create subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await cancelSubscription();
      setSubscriptionPlan(SubscriptionPlan.FREE);
      toast.success('Subscription cancelled successfully');
    } catch (error) {
      console.error('Cancellation failed:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setLoading(false);
      setShowCancelDialog(false);
    }
  };

  const getFeatureIcon = (feature: { text: string; footnote?: string; negative?: boolean }) => {
    if (feature.negative) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  };

  return (
    <div className="w-full bg-background px-4 py-8">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('Razorpay script loaded');
          setScriptLoaded(true);
        }}
        onError={() => {
          console.error('Failed to load Razorpay script');
          toast.error('Failed to load payment gateway. Please refresh the page.', {
            action: {
              label: 'Retry',
              onClick: () => window.location.reload()
            }
          });
          setScriptLoaded(false);
        }}
      />

      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Choose the plan that&apos;s right for you
          </p>
          {subscriptionPlan !== SubscriptionPlan.FREE && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <Badge className="bg-primary px-3 py-1 text-primary-foreground">
                Current Plan: {subscriptionPlan}
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => setShowCancelDialog(true)}
                disabled={loading}
              >
                Cancel Plan
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {pricingItems.map((item) => (
            <Card 
              key={item.plan} 
              className={`flex h-full flex-col border ${
                subscriptionPlan === item.plan.toUpperCase()
                  ? 'border-primary ring-2 ring-primary'
                  : ''
              }`}
            >
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-bold">{item.plan}</CardTitle>
                {subscriptionPlan === item.plan.toUpperCase() && (
                  <Badge variant="outline" className="border-green-500 text-green-500">
                    Current Plan
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="flex items-baseline text-zinc-900 dark:text-zinc-50">
                  <span className="text-4xl font-bold tracking-tight">₹{item.price}</span>
                  {item.price > 0 && <span className="ml-1 text-sm font-semibold">/month</span>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.tagline}</p>
                
                <div className="mt-6 space-y-4">
                  {item.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      {getFeatureIcon(feature)}
                      <div>
                        <p className={`text-sm ${feature.negative ? 'text-muted-foreground line-through' : ''}`}>
                          {feature.text}
                        </p>
                        {feature.footnote && (
                          <p className="mt-1 text-xs text-muted-foreground">{feature.footnote}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="mt-auto pt-4">
                {item.plan === 'Free' ? (
                  subscriptionPlan === SubscriptionPlan.FREE ? (
                    <Button disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      Downgrade
                    </Button>
                  )
                ) : (
                  <Button 
                    onClick={() => handleSubscribe(item.plan.toUpperCase() as 'PRO' | 'PREMIUM')}
                    disabled={
                      loading || 
                      !scriptLoaded || 
                      subscriptionPlan === item.plan.toUpperCase() ||
                      subscriptionPlan !== SubscriptionPlan.FREE
                    }
                    variant={subscriptionPlan === item.plan.toUpperCase() ? "outline" : "default"}
                    className="w-full"
                  >
                    {loading && selectedPlan === item.plan.toUpperCase() ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </div>
                    ) : !scriptLoaded ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    ) : subscriptionPlan === item.plan.toUpperCase() ? (
                      "Current Plan"
                    ) : subscriptionPlan !== SubscriptionPlan.FREE ? (
                      "Cancel Current Plan First"
                    ) : (
                      `Upgrade to ${item.plan}`
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-10">
          <div className="mx-auto max-w-md text-center">
            <p className="text-sm text-muted-foreground">
              Have questions about our pricing or features? <span className="font-medium text-primary">Contact our support team</span>
            </p>
          </div>
        </div>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="p-6 sm:max-w-[450px] bg-white text-black">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-xl">
              Cancel Subscription
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to cancel your subscription? You&apos;ll lose access to {subscriptionPlan} features immediately and be downgraded to the FREE plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex-col gap-3 sm:flex-row">
            <AlertDialogCancel
              disabled={loading}
              className="w-full text-base sm:w-auto"
            >
              Keep Subscription
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={loading}
              className="w-full bg-red-500 text-base text-white hover:bg-red-600 sm:w-auto"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                'Yes, cancel subscription'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
