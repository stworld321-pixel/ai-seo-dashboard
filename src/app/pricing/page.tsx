import { Metadata } from "next";
import { getCurrentUser } from "@/server/auth";
import { getSystemSettingValue } from "@/server/services/system-settings";
import { PricingClient } from "@/components/pricing-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subscription Plans & Pricing — AI SEO Command Center",
  description: "Scale your organic traffic and autonomous AI search visibility with our flexible pricing plans.",
};

export default async function PricingPage() {
  const currentUser = await getCurrentUser();
  const plansConfigJson = await getSystemSettingValue("plans_config");
  const stripePublishableKey = await getSystemSettingValue("stripe_publishable_key");
  const razorpayKeyId = await getSystemSettingValue("razorpay_key_id");

  let parsedPlans = [];
  try {
    parsedPlans = JSON.parse(plansConfigJson);
  } catch {
    parsedPlans = [];
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] py-12 px-4 sm:px-6 lg:px-8">
      <PricingClient
        plans={parsedPlans}
        currentPlan={currentUser ? (currentUser as any).plan || "BASIC" : null}
        isLoggedIn={Boolean(currentUser)}
        userEmail={currentUser?.email}
        stripeKey={stripePublishableKey}
        razorpayKey={razorpayKeyId}
      />
    </div>
  );
}
