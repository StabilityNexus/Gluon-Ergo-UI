/**
 * Analytics Dashboard Page
 * Displays transaction analytics and statistics
 */

import { useState, useEffect } from "react";
import { getTransactionStats, getVolumeByPeriod, getSuccessRate, TimePeriod } from "@/lib/utils/analytics-utils";
import { getDBInstance } from "@/lib/utils/indexed-db";
import { nanoErgsToErgs } from "@/lib/utils/erg-converter";
import { Button } from "@/lib/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/components/ui/card";
import { SEO } from "@/lib/components/layout/SEO";
import { TokenFlowVisualization } from "@/lib/components/blocks/TokenFlowVisualization";

export default function Analytics() {
  const [period, setPeriod] = useState<TimePeriod>("week");
  const [stats, setStats] = useState<any>(null);
  const [successRates, setSuccessRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const db = getDBInstance();
      await db.init();

      const [statsData, , successData] = await Promise.all([getTransactionStats(), getVolumeByPeriod(period), getSuccessRate()]);

      setStats(statsData);
      setSuccessRates(successData);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  if (loading) {
    return (
      <>
        <SEO title="Analytics - Gluon" description="View analytics and statistics for Gluon protocol transactions" />
        <main className="container mx-auto min-h-screen px-4 py-8">
          <div className="text-center">
            <p>Loading analytics...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SEO title="Analytics - Gluon" description="View analytics and statistics for Gluon protocol transactions" />
      <main className="container mx-auto min-h-screen px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-6 text-3xl font-bold">Transaction Analytics</h1>

          {/* Period Selector */}
          <div className="mb-6 flex gap-2">
            <Button variant={period === "day" ? "default" : "outline"} size="sm" onClick={() => setPeriod("day")}>
              24 Hours
            </Button>
            <Button variant={period === "week" ? "default" : "outline"} size="sm" onClick={() => setPeriod("week")}>
              7 Days
            </Button>
            <Button variant={period === "month" ? "default" : "outline"} size="sm" onClick={() => setPeriod("month")}>
              30 Days
            </Button>
            <Button variant={period === "all" ? "default" : "outline"} size="sm" onClick={() => setPeriod("all")}>
              All Time
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{stats?.confirmed || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">{stats?.pending || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{stats?.failed || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Transaction Breakdown */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Transaction Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground">Fission:</span>
                  <span className="ml-2 font-semibold">{stats?.byType?.fission || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fusion:</span>
                  <span className="ml-2 font-semibold">{stats?.byType?.fusion || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Transmute to Gold:</span>
                  <span className="ml-2 font-semibold">{stats?.byType?.["transmute-to-gold"] || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Transmute from Gold:</span>
                  <span className="ml-2 font-semibold">{stats?.byType?.["transmute-from-gold"] || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Success Rates */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Success Rates by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {successRates.map((rate) => (
                  <div key={rate.actionType} className="flex items-center justify-between">
                    <span className="capitalize">{rate.actionType.replace(/-/g, " ")}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {rate.confirmed}/{rate.total}
                      </span>
                      <div className="h-2 w-32 rounded-full bg-secondary">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${rate.successRate}%` }} />
                      </div>
                      <span className="w-16 text-right font-semibold">{rate.successRate.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Token Flow Visualization */}
          <TokenFlowVisualization period={period} />

          {/* Total Fees */}
          <Card>
            <CardHeader>
              <CardTitle>Total Fees Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{nanoErgsToErgs(stats?.totalFees || "0").toString()} ERG</div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
