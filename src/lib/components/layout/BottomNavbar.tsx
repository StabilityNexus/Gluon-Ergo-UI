import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/utils";
import { useMediaQuery } from "usehooks-ts";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const socialLinks = [
  {
    href: "https://x.com/StabilityNexus",
    label: "X",
    iconLight: "/logo/X-Black.svg",
    iconDark: "/logo/X-White.svg",
  },
  {
    href: "https://discord.gg/fuuWX4AbJt",
    label: "Discord",
    iconLight: "/logo/Discord-Black.svg",
    iconDark: "/logo/Discord-White.svg",
  },
  {
    href: "https://t.me/GluonGold",
    label: "Telegram",
    iconLight: "/logo/Telegram-Black.svg",
    iconDark: "/logo/Telegram-White.svg",
  },
  {
    href: "https://github.com/StabilityNexus/Gluon-Ergo-UI",
    label: "Github",
    iconLight: "/logo/Github-Black.svg",
    iconDark: "/logo/Github-White.svg",
  },
];

export function BottomNavbar() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const pathname = usePathname();
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!isMobile) {
    return (
      <div className="w-full shadow-sm backdrop-blur-xl dark:shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center space-x-6 py-4">
            {socialLinks.map(({ href, label, iconLight, iconDark }) => {
              let iconSrc = "/logo/default.svg";

              if (mounted) {
                const currentTheme = theme === "system" ? systemTheme : theme;
                iconSrc = currentTheme === "dark" ? (iconDark ?? iconLight ?? iconSrc) : (iconLight ?? iconDark ?? iconSrc);
              }

              return (
                <Link
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center transition-colors hover:text-primary"
                  aria-label={label}
                >
                  <Image src={iconSrc} alt={label} width={24} height={24} className="h-6 w-6 object-contain" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] w-full bg-background shadow-sm dark:shadow-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-around py-4">
          {[
            { href: "/reactor", label: "Reactor" },
            { href: "/swap", label: "Swap" },
            { href: "/history", label: "History" },
            { href: "/analytics", label: "Analytics" },
            {
              href: "https://docs.stability.nexus/gluon-protocols/gluon-overview",
              label: "Docs",
              external: true,
            },
          ].map((item) => {
            const isActive = item.external ? false : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                className={cn("text-sm font-medium transition-colors hover:text-primary", isActive ? "font-semibold text-primary" : "text-muted-foreground")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
