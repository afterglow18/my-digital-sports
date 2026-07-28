import React from "react";
import { Link, useLocation } from "wouter";
import { Shirt, Sparkles, Bookmark, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetWardrobeStats } from "@/hooks/useLocalDB";

/** Shirt icon with jersey number 25 overlaid in the centre */
function JerseyIcon({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <Shirt className={className} strokeWidth={strokeWidth} />
      <span
        style={{
          position: "absolute",
          fontSize: "0.42em",
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          userSelect: "none",
          pointerEvents: "none",
          marginTop: "0.15em",
        }}
      >
        25
      </span>
    </span>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { data: stats } = useGetWardrobeStats();

  const wardrobeCount = stats?.byCategory
    ? stats.byCategory
        .filter((c: { category: string }) =>
          ["outfits", "beauty", "toiletries", "essentials"].includes(c.category)
        )
        .reduce((sum: number, c: { count: number }) => sum + c.count, 0)
    : undefined;

  const navItems = [
    { href: "/",         label: "Locker",   icon: Shirt,    badge: wardrobeCount },
    { href: "/generate", label: "Generate", icon: Sparkles  },
    { href: "/saved",    label: "Saved",    icon: Bookmark  },
    { href: "/account",  label: "Settings", icon: Settings  },
  ];

  return (
    <div className="flex h-[100dvh] w-full bg-[#EDF6FB]">

      {/* ── Sidebar nav — iPad / desktop only ─────────────────────────────── */}
      <nav
        className="hidden md:flex flex-col items-center w-[76px] flex-shrink-0
                   bg-white border-r-[3px] border-black z-40 gap-1"
        style={{
          paddingTop:    "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* App icon */}
        <div className="w-11 h-11 rounded-xl border-[3px] border-black bg-primary
                        flex items-center justify-center mb-4 flex-shrink-0
                        shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <JerseyIcon className="w-5 h-5 text-black" strokeWidth={2.5} />
        </div>

        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          const isLocker = item.href === "/";
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 w-full px-2 py-1.5 group"
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all relative",
                  isActive
                    ? "bg-primary border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-transparent border-transparent group-hover:bg-muted group-active:scale-95"
                )}
              >
                {isLocker ? (
                  <JerseyIcon
                    className={cn(
                      "w-5 h-5",
                      isActive ? "text-black" : "text-muted-foreground"
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                ) : (
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isActive ? "text-black" : "text-muted-foreground",
                    item.href === "/generate" && isActive ? "animate-pulse" : ""
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                )}
                {item.badge !== undefined && item.badge > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 bg-secondary text-black
                                  text-[9px] font-bold border-2 border-black w-[18px] h-[18px]
                                  flex items-center justify-center rounded-full
                                  shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                    {item.badge > 99 ? "99+" : item.badge}
                  </div>
                )}
              </div>
              <span
                className={cn(
                  "text-[8px] font-bold uppercase tracking-wider transition-colors leading-none",
                  isActive ? "text-black" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── Content column ────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 relative">

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto md:pb-0 relative" style={{ paddingBottom: "110px" }}>
          {children}
        </main>

        {/* ── Bottom nav — mobile only ──────────────────────────────────── */}
        <nav className="md:hidden absolute bottom-0 left-0 right-0 bg-white border-t-[3px] border-black p-3 pb-safe z-[40]">
          <ul className="flex items-center justify-around">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href} className="relative">
                  <Link href={item.href} className="flex flex-col items-center gap-1 group">
                    <div
                      className={cn(
                        "p-2.5 rounded-full border-2 transition-all duration-200 ease-spring relative",
                        isActive
                          ? "bg-primary border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-1"
                          : "bg-transparent border-transparent group-hover:bg-muted group-active:scale-95"
                      )}
                    >
                      {item.href === "/" ? (
                        <JerseyIcon
                          className={cn(
                            "w-6 h-6",
                            isActive ? "text-black" : "text-muted-foreground"
                          )}
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                      ) : (
                      <Icon
                        className={cn(
                          "w-6 h-6",
                          isActive ? "text-black" : "text-muted-foreground",
                          item.href === "/generate" && isActive ? "animate-pulse" : ""
                        )}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      )}
                      {item.badge !== undefined && item.badge > 0 && (
                        <div className="absolute -top-2 -right-2 bg-secondary text-black text-[10px] font-bold border-2 border-black w-5 h-5 flex items-center justify-center rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                          {item.badge > 99 ? "99+" : item.badge}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider transition-colors",
                        isActive ? "text-black" : "text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
