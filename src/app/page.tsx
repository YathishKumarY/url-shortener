import { Footer } from "@/components/landing/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { Navbar } from "@/components/shared/navbar";

export default function HomePage() {
  return (
    <div className="bg-background relative flex min-h-screen flex-col overflow-hidden">
      {/* Decorative cubes */}
      <div className="pointer-events-none absolute -top-16 -left-16 h-[500px] w-[500px] opacity-60">
        <div className="cube absolute bottom-0 left-0 h-[200px] w-[200px]" />
        <div className="cube absolute top-4 right-8 h-[155px] w-[155px]" />
        <div className="cube absolute right-0 bottom-8 h-[200px] w-[200px]" />
      </div>

      <Navbar />
      <main className="flex-1">
        <HeroSection />
      </main>
      <Footer />
    </div>
  );
}
