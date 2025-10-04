import { Button } from "@/lib/components/ui/button";
import { useRouter } from "next/navigation";
import { HeroText } from "../../ui/hero-text";
import { motion } from "framer-motion";

export default function Hero() {
  const router = useRouter();
  return (
    <motion.div
      className="relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="relative z-10">
        <div className="container pt-2">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              className="font-semibold text-foreground dark:text-muted-foreground"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <HeroText />
            </motion.div>

            <motion.div
              className="mx-auto mt-5 max-w-3xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <p className="text-xl text-muted-foreground">
                Trade and transact with digital gold-pegged tokens. <br />
                Secured by the Ergo blockchain and its decentralized gold price oracle.
              </p>
            </motion.div>

            <motion.div
              className="mt-8 flex justify-center gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size={"lg"} onClick={() => router.push("/reactor")}>
                  Start Trading
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size={"lg"}
                  variant={"outline"}
                  onClick={() => router.push("https://docs.stability.nexus/gluon-protocols/gluon-overview")}
                >
                  Read Docs
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
