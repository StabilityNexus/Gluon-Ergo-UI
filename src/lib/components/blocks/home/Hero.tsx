import { Button } from "@/lib/components/ui/button";
import { useRouter } from "next/navigation";
import { HeroText } from "../../ui/hero-text";

export default function Hero() {
  const router = useRouter();
  return (
    <div className="relative overflow-hidden">
      <div className="relative z-10">
        <div className="container pt-24">
          <div className="max-w-4xl text-center mx-auto">
            <div className="text-muted-foreground font-semibold">
              <HeroText />
            </div>

            <div className="mt-5 max-w-3xl mx-auto">
              <p className="text-xl text-muted-foreground">
                Trade, save, and transact with digital gold tokens. Fully backed by physical gold oracles, secured by Ergo's blockchain.
              </p>
            </div>

            <div className="mt-8 gap-3 flex justify-center">
              <Button size={"lg"} onClick={() => router.push("/reactor")}>Start Trading</Button>
              <Button size={"lg"} variant={"outline"} onClick={() => router.push("https://docs.stability.nexus/gluon-protocols/gluon-overview")}>
                Read Docs
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
