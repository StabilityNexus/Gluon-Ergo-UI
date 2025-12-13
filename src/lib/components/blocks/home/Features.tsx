import { Maximize2, Minimize2, Repeat } from "lucide-react";
import { Badge } from "@/lib/components/ui/badge";
import { AnimatedBeam } from "@/lib/components/ui/animated-beam";
import { CardSpotlight } from "@/lib/components/ui/card-spotlight";
import ErgIcon from "@/lib/components/icons/ErgIcon";
import NeutronIcon from "@/lib/components/icons/NeutronIcon";
import ProtonIcon from "@/lib/components/icons/ProtonIcon";
import { tokenConfig } from "@/config/tokenConfig";
import { useRef, forwardRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils/utils";
import { motion } from "framer-motion";

const Circle = forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(({ className, children }, ref) => {
  return (
    <div ref={ref} className={cn("relative z-50 flex size-10 items-center justify-center rounded-full border bg-background", className)}>
      {children}
    </div>
  );
});

Circle.displayName = "Circle";

const TokenFlow = ({
  title,
  fromTokens,
  toTokens,
  reverse = false,
  className = "",
}: {
  title: string;
  fromTokens: Array<"ERG" | typeof tokenConfig.stableAsset.symbol | typeof tokenConfig.volatileAsset.symbol>;
  toTokens: Array<"ERG" | typeof tokenConfig.stableAsset.symbol | typeof tokenConfig.volatileAsset.symbol>;
  reverse?: boolean;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fromRefs = useRef<(HTMLDivElement | null)[]>([]);
  const toRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [refsReady, setRefsReady] = useState(false);

  // Check if all refs are populated
  useEffect(() => {
    const checkRefs = () => {
      const fromRefsReady = fromRefs.current.every((ref, index) => (index < fromTokens.length ? ref !== null && ref !== undefined : true));
      const toRefsReady = toRefs.current.every((ref, index) => (index < toTokens.length ? ref !== null && ref !== undefined : true));

      if (fromRefsReady && toRefsReady && containerRef.current) {
        setRefsReady(true);
      }
    };

    // Check refs after a short delay to ensure DOM is ready
    const timer = setTimeout(checkRefs, 100);
    return () => clearTimeout(timer);
  }, [fromTokens.length, toTokens.length]);

  const getTokenIcon = (token: "ERG" | typeof tokenConfig.stableAsset.symbol | typeof tokenConfig.volatileAsset.symbol) => {
    const iconProps = { className: "w-8 h-8" };
    const stableSymbol = tokenConfig.stableAsset.symbol;
    const volatileSymbol = tokenConfig.volatileAsset.symbol;
    switch (token) {
      case "ERG":
        return <ErgIcon {...iconProps} />;
      case stableSymbol:
      case "GAU": // Legacy support
        return <NeutronIcon {...iconProps} />;
      case volatileSymbol:
      case "GAUC": // Legacy support
        return <ProtonIcon {...iconProps} />;
    }
  };

  return (
    <motion.div
      className={`relative z-10 flex h-full w-full flex-col items-center justify-center space-y-2 rounded-2xl border bg-background p-4 ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <motion.p
        className="relative z-10 text-center text-sm font-semibold"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2 }}
      >
        {title}
      </motion.p>
      <div ref={containerRef} className="relative flex h-28 w-full items-center justify-between px-4">
        {/* From Tokens */}
        <div className="relative z-10 flex flex-col items-center space-y-3">
          {fromTokens.map((token, index) => (
            <motion.div
              key={`from-${token}-${index}`}
              className="flex flex-col items-center space-y-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1, duration: 0.3 }}
            >
              <Circle
                ref={(el) => {
                  fromRefs.current[index] = el;
                }}
              >
                {getTokenIcon(token)}
              </Circle>
              <span className="text-xs font-medium">{token}</span>
            </motion.div>
          ))}
        </div>

        {/* To Tokens */}
        <div className="relative z-10 flex flex-col items-center space-y-3">
          {toTokens.map((token, index) => (
            <motion.div
              key={`to-${token}-${index}`}
              className="flex flex-col items-center space-y-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1, duration: 0.3 }}
            >
              <Circle
                ref={(el) => {
                  toRefs.current[index] = el;
                }}
              >
                {getTokenIcon(token)}
              </Circle>
              <span className="text-xs font-medium">{token}</span>
            </motion.div>
          ))}
        </div>

        {/* Animated Beams */}
        {refsReady && (
          <div className="z-1 pointer-events-none absolute inset-0">
            {fromTokens.flatMap((_, fromIndex) =>
              toTokens.map((_, toIndex) => (
                <AnimatedBeam
                  key={`beam-${fromIndex}-${toIndex}`}
                  containerRef={containerRef}
                  fromRef={{ current: fromRefs.current[fromIndex] }}
                  toRef={{ current: toRefs.current[toIndex] }}
                  curvature={fromTokens.length > 1 || toTokens.length > 1 ? (fromIndex === 0 && toIndex === 0 ? -8 : fromIndex === 1 || toIndex === 1 ? 8 : 0) : 0}
                  reverse={reverse}
                  duration={2.5}
                  delay={(fromIndex + toIndex) * 0.3}
                  gradientStartColor="#ffd007"
                  gradientStopColor="#ffd007"
                  pathColor="#857773"
                  pathWidth={2}
                  pathOpacity={0.2}
                />
              ))
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const Features = () => (
  <motion.div className="w-full py-10 lg:py-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
    <div className="container mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <CardSpotlight
          className="container grid grid-cols-1 items-center gap-8 rounded-xl border-border bg-gradient-to-r from-background to-card p-8 py-8 shadow-lg dark:shadow-neutral-800 lg:grid-cols-2"
          radius={300}
          color="#262626"
        >
          <motion.div className="flex flex-col gap-10" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
            <div className="flex flex-col gap-4">
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.3 }}>
                <Badge variant="outline" className="z-20">
                  Simple to use
                </Badge>
              </motion.div>
              <div className="flex flex-col gap-2">
                <motion.h2
                  className="font-regular z-20 max-w-xl text-left text-3xl tracking-tighter lg:text-5xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  Gluon Mechanics
                </motion.h2>
                <motion.p
                  className="z-20 max-w-lg text-left text-lg leading-relaxed tracking-tight text-muted-foreground"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  {tokenConfig.stableAsset.description}
                  <br />
                  {tokenConfig.stableAsset.displayName} is the stablecoin {tokenConfig.peg.description.toLowerCase()}.
                  <br />
                  <br />
                  {tokenConfig.volatileAsset.description}
                  <br />
                  {tokenConfig.volatileAsset.displayName} tokenizes the reserve surplus.
                  <br />
                  <br />
                  Both {tokenConfig.stableAsset.displayName} and {tokenConfig.volatileAsset.displayName} are fully backed by ERG.
                </motion.p>
              </div>
            </div>
            <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-3 lg:grid-cols-1 lg:pl-6">
              {[
                {
                  icon: Maximize2,
                  title: "Fission",
                  description: `Splits $ERG tokens into $${tokenConfig.stableAsset.symbol} stable tokens and $${tokenConfig.volatileAsset.symbol} volatile tokens`,
                },
                {
                  icon: Minimize2,
                  title: "Fusion",
                  description: `Merges $${tokenConfig.stableAsset.symbol} stable tokens and $${tokenConfig.volatileAsset.symbol} volatile tokens into $ERG tokens`,
                },
                {
                  icon: Repeat,
                  title: `Transmute to ${tokenConfig.stableAsset.displayName}`,
                  description: `Transmutes $${tokenConfig.volatileAsset.symbol} volatile tokens into $${tokenConfig.stableAsset.symbol} stable tokens`,
                },
                {
                  icon: Repeat,
                  title: `Transmute from ${tokenConfig.stableAsset.displayName}`,
                  description: `Transmutes $${tokenConfig.stableAsset.symbol} stable tokens into $${tokenConfig.volatileAsset.symbol} volatile tokens`,
                },
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  className="flex flex-row items-start gap-6"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1, duration: 0.4 }}
                  whileHover={{ x: 5 }}
                >
                  <item.icon className="z-20 mt-2 h-4 w-4 text-primary" />
                  <div className="z-20 flex flex-col gap-1">
                    <p>{item.title}</p>
                    <p className="z-20 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
          <motion.div
            className="flex h-full w-full flex-col items-center justify-center space-y-3 rounded-[2rem] p-4"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            {/* Fission: ERG -> Stable + Volatile */}
            <TokenFlow title="Fission" fromTokens={["ERG"]} toTokens={[tokenConfig.stableAsset.symbol, tokenConfig.volatileAsset.symbol]} />

            {/* Fusion: Stable + Volatile -> ERG */}
            <TokenFlow title="Fusion" fromTokens={[tokenConfig.stableAsset.symbol, tokenConfig.volatileAsset.symbol]} toTokens={["ERG"]} reverse={false} />

            {/* Transmute To Stable: Volatile -> Stable */}
            <TokenFlow title={`Transmute to ${tokenConfig.stableAsset.displayName}`} fromTokens={[tokenConfig.volatileAsset.symbol]} toTokens={[tokenConfig.stableAsset.symbol]} />

            {/* Transmute From Stable: Stable -> Volatile */}
            <TokenFlow title={`Transmute from ${tokenConfig.stableAsset.displayName}`} fromTokens={[tokenConfig.stableAsset.symbol]} toTokens={[tokenConfig.volatileAsset.symbol]} reverse={false} />
          </motion.div>
        </CardSpotlight>
      </motion.div>
    </div>
  </motion.div>
);
