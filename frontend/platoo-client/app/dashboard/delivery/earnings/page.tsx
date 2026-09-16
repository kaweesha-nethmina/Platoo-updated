"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DeliveryRecord {
  deliveryTime: string;
  earnings: number;
}

export default function EarningsPage() {
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalDeliveries, setTotalDeliveries] = useState(0);
  const [dailyBreakdown, setDailyBreakdown] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [bestDay, setBestDay] = useState<string>("");

  const driverId =
    typeof window !== "undefined"
      ? localStorage.getItem("deliveryManId") || "driver-123"
      : "driver-123";

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const res = await fetch(`http://localhost:3003/api/delivery/driver/${driverId}`);
        const data = await res.json();

        const completed = data.filter((d: any) => d.deliveryStatus === "delivered");
        const total = completed.length;
        const earnings = completed.reduce((sum: number, d: DeliveryRecord) => sum + d.earnings, 0);

        const daily: Record<string, number> = {};
        completed.forEach((d: DeliveryRecord) => {
          const date = new Date(d.deliveryTime).toISOString().split("T")[0];
          daily[date] = (daily[date] || 0) + d.earnings;
        });

        const best = Object.entries(daily).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

        setTotalDeliveries(total);
        setTotalEarnings(earnings);
        setDailyBreakdown(daily);
        setBestDay(best);
      } catch (error) {
        console.error("Failed to fetch earnings", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, [driverId]);

  const navItems = [
    { title: "Dashboard", href: "/dashboard", icon: "home" },
    { title: "Pending Deliveries", href: "/dashboard/delivery/pending-deliveries", icon: "truck" },
    { title: "Earnings", href: "/dashboard/delivery/earnings", icon: "dollar-sign" },
    { title: "Profile", href: "/dashboard/delivery", icon: "user" },
  ];

  const chartData = Object.entries(dailyBreakdown).map(([date, earnings]) => ({
    date,
    earnings,
  }));

  return (
    <DashboardLayout navItems={navItems}>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Earnings Overview</h1>
        {loading ? (
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin h-6 w-6 mr-2 text-orange-600" />
            <span>Loading...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Total Deliveries</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{totalDeliveries}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total Earnings</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-green-600">LKR {totalEarnings.toFixed(2)}</CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Daily Earnings</CardTitle>
                {bestDay && (
                  <CardDescription className="mt-2">
                    🚀 Best Day: <span className="font-semibold">{bestDay}</span>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="earnings"
                      fill="#34d399"
                      radius={[10, 10, 0, 0]}
                      isAnimationActive={true}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
