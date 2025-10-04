import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/lib/components/ui/button";
import { useMediaQuery } from "usehooks-ts";
import { ThemeToggle } from "../toggle/ThemeToggle";
import { cn } from "@/lib/utils/utils";
import { useRouter } from "next/router";
import { WalletConnector } from "../blockchain/connector/WalletConnector";
import { useTheme } from "next-themes";

const navItems = [
  { href: "/reactor", label: "Reactor" },
  { href: "/swap", label: "Swap" },
  { href: "https://docs.stability.nexus/gluon-protocols/gluon-overview", label: "Docs", external: true },
];

export function TopNavbar() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();

  const NavLinks = () => (
    <div className={`flex ${isDesktop ? "gap-6" : "flex-col gap-4"}`}>
      {navItems.map((item) => {
        const isActive = item.external ? false : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              isActive ? "font-semibold text-primary" : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="w-full shadow-sm backdrop-blur-xl dark:shadow-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Left - Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image
                src={theme === "dark" ? "/logo/gluon.png" : "/logo/gluon-light.png"}
                alt="Gluon Logo"
                width={28}
                height={28}
                priority
              />
              {isDesktop && <p className="ml-2 font-sans text-2xl font-medium">GLUON GOLD</p>}
            </Link>
          </div>

          {isDesktop ? (
            <>
              {/* Center - Navigation */}
              <div className="flex items-center justify-center">
                <NavLinks />
              </div>

              {/* Right - Actions */}
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {pathname?.startsWith("/reactor") || pathname?.startsWith("/test") || pathname?.startsWith("/swap") ? (
                  <WalletConnector />
                ) : null}
              </div>
            </>
          ) : (
            <>
              {/* Mobile view */}
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {pathname?.startsWith("/reactor") || pathname?.startsWith("/test") || pathname?.startsWith("/swap") ? (
                  <WalletConnector />
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
