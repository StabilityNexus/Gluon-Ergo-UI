"use client";

import { useMemo } from "react";
import { Card } from "@/lib/components/ui/card";
import { Loader2, BarChart2 } from "lucide-react";
import { tokenConfig } from "@/config/tokenConfig";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useGluonTransactionHistory } from "@/lib/hooks/useGluonTransactionHistory";
import { format as dateFnsFormat } from "date-fns";
import { useTheme } from "next-themes";

export function VolumeChart() {
  const { snapshots, loading, error } = useGluonTransactionHistory();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const SPARSE_THRESHOLD = 10;
  const isSparse = snapshots.length < SPARSE_THRESHOLD;

  const chartData = useMemo(() => {
    if (snapshots.length < 2) return [];

    const grouped: Record<string, { VolumeProtonsToNeutrons: number; VolumeNeutronsToProtons: number }> = {};

    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      
      const nDiff = curr.neutronAmount - prev.neutronAmount;
      const ergVol = Math.abs(curr.ergValue - prev.ergValue);
      
      if (ergVol < 0.000001) continue; // skip insignificant changes

      const dateStr = dateFnsFormat(new Date(curr.timestamp), "MMM d");

      if (!grouped[dateStr]) {
        grouped[dateStr] = { VolumeProtonsToNeutrons: 0, VolumeNeutronsToProtons: 0 };
      }

      if (nDiff > 0) {
        // Neutrons entered box -> User deposited neutrons -> GAU to GAUC (VolumeNeutronsToProtons)
        grouped[dateStr].VolumeNeutronsToProtons += ergVol;
      } else if (nDiff < 0) {
        // Neutrons left box -> User received neutrons -> GAUC to GAU (VolumeProtonsToNeutrons)
        grouped[dateStr].VolumeProtonsToNeutrons += ergVol;
      }
    }

    return Object.entries(grouped).map(([day, vols]) => ({
      day,
      VolumeProtonsToNeutrons: vols.VolumeProtonsToNeutrons,
      VolumeNeutronsToProtons: vols.VolumeNeutronsToProtons
    }));
  }, [snapshots]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
      <Card className="border-border bg-card p-6 mt-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">Volume History</span>
          </div>
          {isSparse && (
            <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
              Showing all available volume
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading volume data...</span>
          </div>
        ) : error && chartData.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <span className="text-sm text-red-500">{error}</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <span className="text-sm text-muted-foreground">No volume data available</span>
          </div>
        ) : (
          <div className="mx-auto w-full" style={{ height: "360px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 0, left: -10, bottom: 10 }} barCategoryGap={isSparse ? 40 : 8} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" opacity={isDark ? 0.2 : 0.06} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af", fontSize: 11 }} tickMargin={10} height={30} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => value.toFixed(1)} tick={{ fill: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af", fontSize: 11 }} width={45} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(2)} ERG`]} 
                  labelStyle={{ color: '#666' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: isDark ? '#1e1e1e' : '#ffffff' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="VolumeProtonsToNeutrons" name={`${tokenConfig.volatileAsset.displayName} → ${tokenConfig.stableAsset.displayName}`} fill={tokenConfig.theme.stableToken} isAnimationActive={true} />
                <Bar dataKey="VolumeNeutronsToProtons" name={`${tokenConfig.stableAsset.displayName} → ${tokenConfig.volatileAsset.displayName}`} fill={tokenConfig.theme.volatileToken} isAnimationActive={true} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
