/**
 * Token Flow Visualization Component
 * Shows fission, fusion, and transmutation flows with charts
 */

import { useState, useEffect } from "react";
import { getTokenFlowAnalytics, TimePeriod, TokenFlow } from "@/lib/utils/analytics-utils";
import { getDBInstance } from "@/lib/utils/indexed-db";
import { nanoErgsToErgs } from "@/lib/utils/erg-converter";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/components/ui/card";

interface TokenFlowVisualizationProps {
  period: TimePeriod;
}

export const TokenFlowVisualization = ({ period }: TokenFlowVisualizationProps) => {
  const [flowData, setFlowData] = useState<TokenFlow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFlowData = async () => {
      setLoading(true);
      try {
        const db = getDBInstance();
        await db.init();
        const data = await getTokenFlowAnalytics(period);
        setFlowData(data);
      } catch (error) {
        console.error("Failed to load token flow data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFlowData();
  }, [period]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading token flow data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Flow Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {flowData.map((flow) => (
            <div key={flow.actionType} className="border-b pb-4 last:border-0">
              <h4 className="mb-3 font-semibold capitalize">{flow.actionType.replace(/-/g, " ")}</h4>

              <div className="grid grid-cols-2 gap-4">
                {/* GAU Section */}
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">GAU</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Created:</span>
                      <span className="font-semibold text-green-500">+{nanoErgsToErgs(flow.gauCreated).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Burned:</span>
                      <span className="font-semibold text-red-500">-{nanoErgsToErgs(flow.gauBurned).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-1">
                      <span className="text-sm font-medium">Net:</span>
                      <span className={`font-bold ${Number(flow.gauCreated) - Number(flow.gauBurned) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {Number(flow.gauCreated) - Number(flow.gauBurned) >= 0 ? "+" : ""}
                        {nanoErgsToErgs(Number(BigInt(flow.gauCreated) - BigInt(flow.gauBurned))).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* GAUC Section */}
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">GAUC</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Created:</span>
                      <span className="font-semibold text-green-500">+{nanoErgsToErgs(flow.gaucCreated).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Burned:</span>
                      <span className="font-semibold text-red-500">-{nanoErgsToErgs(flow.gaucBurned).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-1">
                      <span className="text-sm font-medium">Net:</span>
                      <span className={`font-bold ${Number(flow.gaucCreated) - Number(flow.gaucBurned) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {Number(flow.gaucCreated) - Number(flow.gaucBurned) >= 0 ? "+" : ""}
                        {nanoErgsToErgs(Number(BigInt(flow.gaucCreated) - BigInt(flow.gaucBurned))).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Count */}
              <div className="mt-3 rounded-lg bg-secondary p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Transactions:</span>
                  <span className="font-semibold">{flow.transactionCount}</span>
                </div>
              </div>
            </div>
          ))}

          {flowData.length === 0 && <p className="text-center text-muted-foreground">No token flow data available for this period</p>}
        </div>
      </CardContent>
    </Card>
  );
};
