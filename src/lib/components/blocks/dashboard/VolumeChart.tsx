"use client"

import { useEffect, useState } from "react"
import { Card } from "@/lib/components/ui/card"
import { Loader2, BarChart2 } from "lucide-react"
import { nanoErgsToErgs } from "@/lib/utils/erg-converter"
import { motion } from "framer-motion"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface VolumeChartProps {
  isLoading?: boolean
  hasError?: boolean
}

interface VolumeDataPoint {
  day: number
  VolumeProtonsToNeutrons: number
  VolumeNeutronsToProtons: number
}

export function VolumeChart({
  isLoading: externalLoading = false,
  hasError: externalError = false,
}: VolumeChartProps) {
  const [chartData, setChartData] = useState<VolumeDataPoint[]>([])
  const [loadingChart, setLoadingChart] = useState(true)
  const [chartError, setChartError] = useState(false)
  const [debugMessage, setDebugMessage] = useState<string>("")

  useEffect(() => {
    let isMounted = true

    async function fetchVolumeData() {
      try {
        setLoadingChart(true)
        setChartError(false)

        const sdk = await import("gluon-gold-sdk")
        const gluon = new sdk.Gluon()
        gluon.config.NETWORK = process.env.NEXT_PUBLIC_DEPLOYMENT || "testnet"

        const gluonBox = await gluon.getGluonBox()

        const days = Array.from({ length: 14 }, (_, i) => i + 1)
        const cumulativeData: VolumeDataPoint[] = []

        for (const day of days) {
          const [ProtonsToNeutrons, NeutronsToProtons] = await Promise.all([
            gluonBox.accumulateVolumeProtonsToNeutrons(day),
            gluonBox.accumulateVolumeNeutronsToProtons(day),
          ])

          cumulativeData.push({
            day,
            VolumeProtonsToNeutrons: nanoErgsToErgs(ProtonsToNeutrons).toNumber(),
            VolumeNeutronsToProtons: nanoErgsToErgs(NeutronsToProtons).toNumber(),
          })
        }

        const dailyData: VolumeDataPoint[] = []

        for (let i = 0; i < cumulativeData.length; i++) {
          if (i === 0) {
            dailyData.push({
              day: cumulativeData[i].day,
              VolumeProtonsToNeutrons: cumulativeData[i].VolumeProtonsToNeutrons,
              VolumeNeutronsToProtons: cumulativeData[i].VolumeNeutronsToProtons,
            })
          } else {
            const current = cumulativeData[i]
            const previous = cumulativeData[i - 1]

            dailyData.push({
              day: current.day,
              VolumeProtonsToNeutrons: Math.max(0, current.VolumeProtonsToNeutrons - previous.VolumeProtonsToNeutrons),
              VolumeNeutronsToProtons: Math.max(0, current.VolumeNeutronsToProtons - previous.VolumeNeutronsToProtons),
            })
          }
        }

        const reversed = dailyData.reverse().map((entry, index) => ({
          ...entry,
          day: index + 1,
        }))

        if (isMounted) {
          setChartData(reversed)
        }
      } catch (error) {
        if (isMounted) {
          setChartError(true)
          setDebugMessage(
            `Error: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      } finally {
        if (isMounted) {
          setLoadingChart(false)
        }
      }
    }

    fetchVolumeData()
    return () => {
      isMounted = false
    }
  }, [])

  const isLoading = externalLoading || loadingChart
  const hasError = externalError || chartError

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
    >
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">14-Day Volume History</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <span className="text-sm text-muted-foreground">Loading volume data...</span>
            <span className="text-xs text-muted-foreground mt-2">{debugMessage}</span>
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center h-[300px]">
            <span className="text-sm text-red-500">Error loading volume data</span>
            <span className="text-xs text-red-400 mt-2">{debugMessage}</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px]">
            <span className="text-sm text-muted-foreground">No volume data available</span>
            <span className="text-xs text-muted-foreground mt-2">{debugMessage}</span>
          </div>
        ) : (
          <div className="w-full mx-auto" style={{ height: "360px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 0, left: -10, bottom: 10 }}
                barCategoryGap={8}
                barSize={20}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9.5 }}
                  tickMargin={10}
                  height={30}
                  padding={{ left: 0, right: 0 }}
                />
                <YAxis
                  tickFormatter={(value) => value.toFixed(1)}
                  tick={{ fontSize: 9.5 }}
                  width={45}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)} ERG`]}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <Legend wrapperStyle={{ fontSize: 9.5 }} />
                <Bar dataKey="VolumeProtonsToNeutrons" name="GAUC → GAU" fill="#facc15" />
                <Bar dataKey="VolumeNeutronsToProtons" name="GAU → GAUC" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
