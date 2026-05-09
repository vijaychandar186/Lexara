export const PLAN_LIMITS = {
  FREE: {
    maxFileSizeMB: 4,   // 4MB
    maxPages: 50,       // Max 50 pages per PDF
    quota: 10,          // Max 10 PDFs
  },
  PRO: {
    maxFileSizeMB: 12,  // 12MB
    maxPages: 200,      // Max 200 pages per PDF
    quota: 200,         // Max 200 PDFs
  },
  PREMIUM: {
    maxFileSizeMB: 16,  // 16MB
    maxPages: 500,      // Max 500 pages per PDF
    quota: 500,         // Max 500 PDFs
  },
} as const;

export type SubscriptionPlan = keyof typeof PLAN_LIMITS;

// Helper function to get plan limits
export const getPlanLimits = (plan: SubscriptionPlan) => {
  return PLAN_LIMITS[plan];
};

// Helper function to validate if user can upload based on their plan
export const canUserUpload = (
  currentFileCount: number,
  fileSizeMB: number,
  plan: SubscriptionPlan
): { canUpload: boolean; errorMessage?: string } => {
  const limits = getPlanLimits(plan);

  if (currentFileCount >= limits.quota) {
    return {
      canUpload: false,
      errorMessage: `Upload limit reached. You have ${currentFileCount}/${limits.quota} files for your ${plan} plan.`,
    };
  }

  if (fileSizeMB > limits.maxFileSizeMB) {
    return {
      canUpload: false,
      errorMessage: `File size (${fileSizeMB.toFixed(1)}MB) exceeds the ${limits.maxFileSizeMB}MB limit for your ${plan} plan.`,
    };
  }

  return { canUpload: true };
};