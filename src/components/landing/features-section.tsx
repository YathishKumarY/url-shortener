import { BarChart3, Link2, QrCode, Shield, Timer, Zap } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Fast Redirects",
    description: "Lightning-fast URL redirections powered by Redis caching for instant access.",
  },
  {
    icon: BarChart3,
    title: "Click Analytics",
    description: "Track clicks, referrers, devices, and locations with detailed analytics.",
  },
  {
    icon: Link2,
    title: "Custom Aliases",
    description: "Create memorable custom short links that match your brand identity.",
  },
  {
    icon: QrCode,
    title: "QR Codes",
    description: "Generate QR codes for any shortened URL to share offline or in print.",
  },
  {
    icon: Timer,
    title: "Link Expiration",
    description: "Set expiration dates on links for time-limited campaigns and promotions.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your data is protected with encrypted storage and privacy-first design.",
  },
];

export function FeaturesSection() {
  return (
    <section className="px-6 py-16 md:px-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-foreground mb-10 text-center text-2xl font-bold md:text-3xl">
          Why choose Linkly?
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-card rounded-lg p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] transition-[box-shadow] duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_2px_6px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.12)]"
            >
              <feature.icon className="text-primary mb-3 h-8 w-8" />
              <h3 className="text-foreground mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
