import { cn } from "@/lib/utils";

/** Logical size of the simulated device (an iPhone-sized viewport). */
const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;

/**
 * A phone bezel that renders its children at a real 390x844 viewport and
 * scales the result down, so the preview lays out exactly like a phone.
 * The scale shrinks on short screens via `--phone-scale` so the sticky
 * preview always fits.
 */
export function PhoneFrame({
  children,
  glow,
  className,
}: {
  children: React.ReactNode;
  /** Ambient colour cast beneath the device (the theme accent). */
  glow?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Mutually exclusive ranges, so stylesheet order never matters.
        // 1024-1279px keeps the base 0.7: the column is narrow there.
        "relative mx-auto w-fit [--phone-scale:0.7]",
        "[@media(min-width:640px)_and_(max-width:1023px)_and_(min-height:761px)_and_(max-height:939px)]:[--phone-scale:0.74]",
        "[@media(min-width:640px)_and_(max-width:1023px)_and_(min-height:940px)]:[--phone-scale:0.78]",
        "[@media(min-width:1024px)_and_(max-height:760px)]:[--phone-scale:0.62]",
        "[@media(min-width:1280px)_and_(min-height:761px)_and_(max-height:939px)]:[--phone-scale:0.74]",
        "[@media(min-width:1280px)_and_(min-height:940px)]:[--phone-scale:0.78]",
        className,
      )}
    >
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-1/4 bottom-6 -z-10 rounded-full opacity-35 blur-3xl transition-[background-color] duration-700 dark:opacity-45"
          style={{ backgroundColor: glow }}
        />
      )}

      {/* Side buttons */}
      <span
        aria-hidden
        className="absolute top-[18%] -left-[3px] h-7 w-[3px] rounded-l-sm bg-[#1f2430]"
      />
      <span
        aria-hidden
        className="absolute top-[27%] -left-[3px] h-12 w-[3px] rounded-l-sm bg-[#1f2430]"
      />
      <span
        aria-hidden
        className="absolute top-[24%] -right-[3px] h-16 w-[3px] rounded-r-sm bg-[#1f2430]"
      />

      <div className="rounded-[calc(56px*var(--phone-scale)_+_10px)] bg-linear-to-b from-[#2b303b] via-[#171a22] to-[#0e1016] p-[10px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),0_0_0_1px_rgba(0,0,0,0.55),0_30px_60px_-24px_rgba(0,0,0,0.55)]">
        <div
          className="relative overflow-hidden rounded-[calc(56px*var(--phone-scale))] bg-black"
          style={{
            width: `calc(${SCREEN_WIDTH}px * var(--phone-scale))`,
            height: `calc(${SCREEN_HEIGHT}px * var(--phone-scale))`,
          }}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT,
              transform: "scale(var(--phone-scale))",
            }}
          >
            {children}
            {/* Dynamic island and home indicator, drawn at device scale. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-[11px] left-1/2 z-10 h-[35px] w-[122px] -translate-x-1/2 rounded-full bg-black"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-[8px] left-1/2 z-10 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-white/70 mix-blend-difference"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
