/**
 * @file VolumeChart.tsx
 * @description 14-day transmutation volume bar chart driven by SDK snapshot volume buckets.
 * @module lib/components/blocks/dashboard
 */
"use client";

import { useMemo } from "react";
import { Card } from "@/lib/components/ui/card";
import { Loader2, BarChart2 } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useTheme } from "next-themes";
import { useGluon } from "@/lib/hooks/useGluon";
import { buildVolumeSeries, formatVolumeTick } from "@/lib/functions/reactor/dashboard";
import { deriveReactorErrorMessage } from "@/lib/functions/reactor/availability";

export function VolumeChart() {
  const { snapshot, deployment, status, error } = useGluon();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const neutronName = deployment.tokens.neutron.name;
  const protonName = deployment.tokens.proton.name;

  const chartData = useMemo(() => {
    if (!snapshot) return [];
    return buildVolumeSeries(snapshot.volumes.plus, snapshot.volumes.minus);
  }, [snapshot]);

  const hasAnyVolume = useMemo(
    () => chartData.some((p) => p.plusNano > 0n || p.minusNano > 0n),
    [chartData]
  );

  const isLoading = !snapshot && status === "loading";
  const hasError = !snapshot && status === "error";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
      <Card className="mt-8 border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">14-Day Transmutation Volume</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading volume data…</span>
          </div>
        ) : hasError ? (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <span className="text-sm text-destructive">{deriveReactorErrorMessage(error)}</span>
          </div>
        ) : chartData.length === 0 || !hasAnyVolume ? (
          <div className="flex h-[300px] flex-col items-center justify-center">
            <span className="text-sm text-muted-foreground">No volume data available</span>
          </div>
        ) : (
          <div className="mx-auto w-full" style={{ height: "360px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 0, left: -10, bottom: 10 }} barCategoryGap={8} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" opacity={isDark ? 0.2 : 0.06} vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af", fontSize: 11 }}
                  tickMargin={10}
                  height={30}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatVolumeTick}
                  tick={{ fill: isDark ? "rgba(255,255,255,0.3)" : "#9ca3af", fontSize: 11 }}
                  width={52}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(4)} ERG`]}
                  labelStyle={{ color: "#666" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: isDark ? "#1e1e1e" : "#ffffff",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="plusErg" name={`${protonName} → ${neutronName}`} fill="var(--stable-token, #ffd007)" isAnimationActive={true} />
                <Bar dataKey="minusErg" name={`${neutronName} → ${protonName}`} fill="var(--volatile-token, #e3201f)" isAnimationActive={true} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
