import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/lib/components/ui/button";
import { Menu } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/lib/components/ui/drawer";
import { ThemeToggle } from "../toggle/ThemeToggle";
import { cn } from "@/lib/utils/utils";
import { useRouter } from "next/router";
import { WalletConnector } from "../blockchain/connector/WalletConnector";
import { useTheme } from "next-themes";

const navItems = [
  { href: "/reactor", label: "Reactor" },
  { href: "https://docs.stability.nexus/gluon-protocols/gluon-overview", label: "Docs", external: true },
];

export function TopNavbar() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();

  const NavLinks = () => (
    <div className={`flex ${isDesktop ? 'gap-6' : 'flex-col gap-4'}`}>
      {navItems.map((item) => {
        const isActive = item.external
          ? false
          : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              isActive
                ? "text-primary font-semibold"
                : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="w-full dark:shadow-lg shadow-sm backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left - Logo */}
          <div className="flex items-center ">
            <Link href="/" className="flex items-center">
              <Image
                src={theme === "dark" ? "/logo/gluon.png" : "/logo/gluon-light.png"}
                alt="Gluon Logo"
                width={28}
                height={28}
                priority
              />
              <p className="ml-2 text-2xl font-medium font-sans">GLUON GOLD</p>
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
                {pathname?.startsWith("/reactor") || pathname?.startsWith("/test") ? (
                  <WalletConnector />
                ) : (
                  <Button variant="default" size="sm" onClick={() => router.push('/reactor')}>
                    Open Reactor
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Drawer direction="bottom">
                  <DrawerTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
                      <NavLinks />
                      <Button variant="default" size="sm">
                        Connect Wallet
                      </Button>
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}