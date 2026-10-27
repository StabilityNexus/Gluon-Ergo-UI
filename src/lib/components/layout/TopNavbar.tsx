import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Button } from "@/lib/components/ui/button";
import { ThemeToggle } from "../toggle/ThemeToggle";
import { cn } from "@/lib/utils/utils";
import { resolveAssetPath } from "@/lib/utils/asset-path";
import { useRouter } from "next/router";
import { WalletConnector } from "../blockchain/connector/WalletConnector";
import { tokenConfig } from "@/config/tokenConfig";

// Hidden during B1 foundation; ported back in B2 (swap) and B4 (reactor)
const navItems = [
  { href: "/history", label: "History" },
  {
    href: "https://docs.stability.nexus/gluon-protocols/gluon-overview",
    label: "Docs",
    external: true,
  },
];

export function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const NavLinks = () => (
    <div className="flex gap-6">
      {navItems.map((item) => {
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
  );

  return (
    <div className="sticky top-0 z-50 w-full shadow-sm backdrop-blur-xl dark:shadow-lg">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Left - Logo */}
          <div className="flex flex-1 items-center">
            <Link href="/" className="flex items-center">
              <Image src={resolveAssetPath(tokenConfig.favicon, router.basePath)} alt="Gluon Logo" width={28} height={28} priority />
              <p className="ml-2 hidden font-sans text-2xl font-medium md:block">{tokenConfig.protocolName}</p>
            </Link>
          </div>

          {/* Center - Navigation (desktop only) */}
          <div className="hidden items-center justify-center md:flex">
            <NavLinks />
          </div>

          {/* Right - Actions */}
          <div className="flex flex-1 items-center justify-end gap-2">
            <ThemeToggle />
            {pathname?.startsWith("/reactor") || pathname?.startsWith("/test") || pathname?.startsWith("/swap") || pathname?.startsWith("/history") ? (
              <WalletConnector />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
