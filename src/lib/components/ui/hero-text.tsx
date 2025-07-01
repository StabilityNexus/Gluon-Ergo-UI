import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight, PhoneCall } from "lucide-react";
import { Button } from "@/lib/components/ui/button";

function HeroText() {
    const [titleNumber, setTitleNumber] = useState(0);
    const titles = useMemo(
        () => ["Decentralized", "Autonomous", "Permissionless", "Transparent", "Fully Crypto Backed", "Gold-Pegged"],
        []
    );

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (titleNumber === titles.length - 1) {
                setTitleNumber(0);
            } else {
                setTitleNumber(titleNumber + 1);
            }
        }, 2000);
        return () => clearTimeout(timeoutId);
    }, [titleNumber, titles]);

    return (
        <div className="w-full">
            <div className="container mx-auto">
                <div className="flex gap-8 pt-20 lg:pt-40 items-center justify-center flex-col">
                    <div className="flex gap-4 flex-col">
                        <h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-7xl dark:text-white">
                            <span className="relative flex justify-center overflow-hidden w-screen text-center md:pb-4 md:pt-1">
                                &nbsp;
                                {titles.map((title, index) => (
                                    <motion.span
                                        key={index}
                                        className="absolute font-semibold"
                                        initial={{ opacity: 0, y: "-100" }}
                                        transition={{ type: "spring", stiffness: 50 }}
                                        animate={
                                            titleNumber === index
                                                ? {
                                                    y: 0,
                                                    opacity: 1,
                                                }
                                                : {
                                                    y: titleNumber > index ? -150 : 150,
                                                    opacity: 0,
                                                }
                                        }
                                    >
                                        {title}
                                    </motion.span>
                                ))}
                            </span>

                            <span className="text-primary">Stablecoin</span>
                        </h1>
                    </div>
                </div>
            </div>
        </div>
    );
}

export { HeroText };
