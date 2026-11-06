import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DeveloperSection } from "@/components/landing/developer-section";
import { CtaSection, FaqSection } from "@/components/landing/faq-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { Footer } from "@/components/landing/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { Navbar } from "@/components/shared/navbar";
import { getAppOrigin } from "@/lib/app-url";
import { config } from "@/lib/config";
import { resolveRequestDomain } from "@/lib/domains";

export default async function HomePage() {
  // On a custom domain, "/" belongs to the domain owner: send visitors to
  // their configured root URL (or the app) instead of showing our landing page.
  const requestHeaders = await headers();
  const { settings } = await resolveRequestDomain(
    new Request("http://localhost/", { headers: requestHeaders }),
  );
  if (settings) redirect(settings.rootRedirect ?? getAppOrigin());

  return (
    <div className="bg-background relative flex min-h-screen flex-col overflow-x-clip">
      {/* Decorative cubes */}
      <div className="pointer-events-none absolute -top-16 -left-16 h-[500px] w-[500px] opacity-60">
        <div className="cube absolute bottom-0 left-0 h-[200px] w-[200px]" />
        <div className="cube absolute top-4 right-8 h-[155px] w-[155px]" />
        <div className="cube absolute right-0 bottom-8 h-[200px] w-[200px]" />
      </div>
      <div className="pointer-events-none absolute top-[38rem] right-[-10rem] size-[32rem] rounded-full bg-[#144ee3]/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-[90rem] left-[-12rem] size-[30rem] rounded-full bg-[#eb568e]/10 blur-[120px]" />

      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <DeveloperSection origin={getAppOrigin()} />
        <FaqSection />
        <CtaSection registrationEnabled={!config.registrationDisabled} />
      </main>
      <Footer />
    </div>
  );
}
