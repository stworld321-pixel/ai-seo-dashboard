import { OnboardingWizard } from "@/components/onboarding-wizard";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-[var(--color-background)] px-4 py-12">
      <OnboardingWizard />
    </main>
  );
}
