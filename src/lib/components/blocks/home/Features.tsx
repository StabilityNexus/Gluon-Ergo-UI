import { Check, Maximize2, Minimize2, Repeat } from "lucide-react";
import { Badge } from "@/lib/components/ui/badge";
import { FissionExample } from "./featuresSVG/fission";
import { FusionExample } from "./featuresSVG/fusion";
import { TransmuteToExample } from "./featuresSVG/transmuteTo";
import { TransmuteFromExample } from "./featuresSVG/transmuteFrom";

export const Features = () => (
  <div className="w-full py-10 lg:py-20">
    <div className="container mx-auto">
      <div className="grid border rounded-lg container py-8 p-8 grid-cols-1 gap-8 items-center lg:grid-cols-2">
        <div className="flex gap-10 flex-col">
          <div className="flex gap-4 flex-col">
            <div>
              <Badge variant="outline">Simple to use</Badge>
            </div>
            <div className="flex gap-2 flex-col">
              <h2 className="text-3xl lg:text-5xl tracking-tighter max-w-xl text-left font-regular">
                Gluon Mechanics
              </h2>
              <p className="text-lg leading-relaxed tracking-tight text-muted-foreground max-w-lg text-left">
                Gluon enables you to protect your wealth with $GAU while being able to leverage volatility and get yield with $GAUC
              </p>
            </div>
          </div>
          <div className="grid lg:pl-6 grid-cols-1 sm:grid-cols-3 items-start lg:grid-cols-1 gap-6">
            <div className="flex flex-row gap-6 items-start">
            <Maximize2  className="w-4 h-4 mt-2 text-primary"/>
              <div className="flex flex-col gap-1">
                <p>Fission</p>
                <p className="text-muted-foreground text-sm">
                Splits $ERG tokens into $GAU stable tokeons and $GAUC volatile tokeons
                </p>
              </div>
            </div>
            <div className="flex flex-row gap-6 items-start">
                <Minimize2  className="w-4 h-4 mt-2 text-primary"/>
              <div className="flex flex-col gap-1">
                <p>Fusion</p>
                <p className="text-muted-foreground text-sm">
                Merges $GAU stable tokeons and $GAUC volatile tokeons into $ERG tokens
                </p>
              </div>
            </div>
            <div className="flex flex-row gap-6 items-start">
            <Repeat className="w-4 h-4 mt-2 text-primary"/>
              <div className="flex flex-col gap-1">
                <p>Transmute to Gold</p>
                <p className="text-muted-foreground text-sm">
                Transmutes $GAUC volatile tokeons into $GAU stable tokeons
                </p>
              </div>
            </div>
            <div className="flex flex-row gap-6 items-start">
                <Repeat className="w-4 h-4 mt-2 text-primary"/>
              <div className="flex flex-col gap-1">
                <p>Transmute from Gold</p>
                <p className="text-muted-foreground text-sm">
                Transmutes $GAU stable tokeons into $GAUC volatile tokeons
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-[3rem] h-full w-full  p-8 flex flex-col items-center justify-center space-y-4">
  <div className="w-full h-full flex flex-col items-center justify-center space-y-4 border rounded-3xl p-4 ">
    <p className="text-center text-lg font-bold ">Fission</p>
    <FissionExample/>
  </div>
  <div className="w-full h-full flex flex-col items-center justify-center space-y-4 border rounded-3xl p-4">
    <p className="text-center text-lg font-bold">Fusion</p>
    <FusionExample/>
  </div>
  <div className="w-full h-full flex flex-col items-center justify-center space-y-4 border rounded-3xl p-4">
    <p className="text-center text-lg font-bold">Transmute To Gold</p>
    <TransmuteToExample/>
  </div>
  <div className="w-full h-full flex flex-col items-center justify-center space-y-4 border rounded-3xl p-4">
    <p className="text-center text-lg font-bold">Transmute From Gold</p>
    <TransmuteFromExample/>
  </div>
</div>
      </div>
    </div>
  </div>
);