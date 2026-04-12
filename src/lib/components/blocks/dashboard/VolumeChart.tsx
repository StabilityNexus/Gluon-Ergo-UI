"use client";

import { useEffect, useState } from "react";
import { Card } from "@/lib/components/ui/card";
import { Loader2, BarChart2 } from "lucide-react";
import { nanoErgsToErgs } from "@/lib/utils/erg-converter";
import { tokenConfig } from "@/config/tokenConfig";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface VolumeChartProps {
  isLoading?: boolean;
  hasError?: boolean;
  volArrayPN?: number[];
  volArrayNP?: number[];
}

interface VolumeDataPoint {
  day: number;
  VolumeProtonsToNeutrons: number;
  VolumeNeutronsToProtons: number;
}

export function VolumeChart({ isLoading = false, hasError = false, volArrayPN = [], volArrayNP = [] }: VolumeChartProps) {
  const [chartData, setChartData] = useState<VolumeDataPoint[]>([]);

  useEffect(() => {
    if (!volArrayPN.length || !volArrayNP.length) {
      setChartData([]);
      return;
    }
    
    if (volArrayPN.length !== volArrayNP.length) {
      console.warn(`Volume array length mismatch: PN=${volArrayPN.length}, NP=${volArrayNP.length}`);
    }

    const reversedPN = [...volArrayPN].reverse();
    const reversedNP = [...volArrayNP].reverse();
    const len = Math.min(reversedPN.length, reversedNP.length);
    
    if (len === 0) {
      setChartData([]);
      return;
    }

    const chartPoints = [];
    for (let i = 0; i < len; i++) {
      chartPoints.push({
        day: i + 1,
        VolumeProtonsToNeutrons: nanoErgsToErgs(reversedPN[i]).toNumber(),
        VolumeNeutronsToProtons: nanoErgsToErgs(reversedNP[i]).toNumber(),
      });
    }

    setChartData(chartPoints);
  }, [volArrayPN, volArrayNP]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
      <Card className="border-border bg-card p-6 mt-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">14-Day Volume History</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading volume data...</span>
          </div>
        ) : hasError ? (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <span className="text-sm text-red-500">Error loading volume data</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <span className="text-sm text-muted-foreground">No volume data available</span>
          </div>
        ) : (
          <div className="mx-auto w-full" style={{ height: "360px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 0, left: -10, bottom: 10 }} barCategoryGap={8} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 9.5 }} tickMargin={10} height={30} padding={{ left: 0, right: 0 }} />
                <YAxis tickFormatter={(value) => value.toFixed(1)} tick={{ fontSize: 9.5 }} width={45} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(2)} ERG`]} labelFormatter={(label) => `Day ${label}`} />
                <Legend wrapperStyle={{ fontSize: 9.5 }} />
                <Bar dataKey="VolumeProtonsToNeutrons" name={`${tokenConfig.volatileAsset.displayName} → ${tokenConfig.stableAsset.displayName}`} fill={tokenConfig.theme.stableToken} />
                <Bar dataKey="VolumeNeutronsToProtons" name={`${tokenConfig.stableAsset.displayName} → ${tokenConfig.volatileAsset.displayName}`} fill={tokenConfig.theme.volatileToken} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
