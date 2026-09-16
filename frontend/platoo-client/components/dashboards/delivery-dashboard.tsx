"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Clock, Download, MapPin, Truck } from "lucide-react";
import dynamic from "next/dynamic";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const DeliveryMap = dynamic(() => import("@/components/DeliveryMap"), { ssr: false });

interface OrderItem {
  menu_item_id: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customer: { name: string; address: string; latitude: number; longitude: number };
  restaurant: { id: string; name: string; latitude: number; longitude: number };
  items: OrderItem[];
  total: string;
  driverLocation: { lat: number; lng: number };
}

export default function DeliveryDashboard() {
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [totalDeliveries, setTotalDeliveries] = useState(0);
  const [todayDeliveries, setTodayDeliveries] = useState(0);
  const [deliveryHistory, setDeliveryHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [phase, setPhase] = useState<"idle" | "going_to_restaurant" | "going_to_customer">("idle");

  const driverId = typeof window !== "undefined" ? localStorage.getItem("deliveryManId") || "driver-123" : "driver-123";


  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        localStorage.setItem("driverLatitude", position.coords.latitude.toString());
        localStorage.setItem("driverLongitude", position.coords.longitude.toString());
        console.log("✅ Driver location saved automatically");
      }, (error) => {
        console.error("❌ Error fetching driver location", error);
      });
    }
  }, []);
  

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchActiveOrderWithDetails();
    fetchHistory();
  }, []);

  const fetchActiveOrderWithDetails = async () => {
    const stored = localStorage.getItem("activeOrder");
    if (!stored) return;
    const parsedOrder = JSON.parse(stored);
    setActiveOrder(parsedOrder);
    if (parsedOrder.driverLocation) {
      setDriverLocation(parsedOrder.driverLocation);
    }
  };

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:3003/api/delivery/driver/${driverId}`);
      const data = await res.json();
      const delivered = data.filter((d: any) => d.deliveryStatus === "delivered");
      const today = new Date().toISOString().split("T")[0];
      const todayDone = delivered.filter((d: any) => d.deliveryTime.split("T")[0] === today);

      setTotalDeliveries(delivered.length);
      setTodayDeliveries(todayDone.length);
      setDeliveryHistory(delivered);
    } catch (err) {
      console.error("Error fetching delivery history", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoute = async (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    try {
      const res = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-car/geojson`,
        {
          method: "POST",
          headers: {
            "Authorization": `5b3ce3597851110001cf6248dc268f1e36654c6b82014bc0e02c4fa0`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            coordinates: [
              [start.lng, start.lat],
              [end.lng, end.lat],
            ],
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch route");
      }

      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        setRouteCoords(coords);
      } else {
        console.error("❌ No route found:", data);
      }
    } catch (error) {
      console.error("❌ Error fetching route:", error);
    }
  };

  const handleAccept = async () => {
    if (!driverLocation || !activeOrder) {
      console.error("❌ Driver location or active order missing");
      return;
    }
    setPhase("going_to_restaurant");
    await fetchRoute(driverLocation, {
      lat: activeOrder.restaurant.latitude,
      lng: activeOrder.restaurant.longitude,
    });
  };

  const handlePickup = async () => {
    if (!activeOrder) return;
    setPhase("going_to_customer");
    await fetchRoute(
      { lat: activeOrder.restaurant.latitude, lng: activeOrder.restaurant.longitude },
      { lat: activeOrder.customer.latitude, lng: activeOrder.customer.longitude }
    );
  };

  const completeDelivery = async () => {
    if (!activeOrder) return;
    try {
      await fetch("http://localhost:3003/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: activeOrder.id,
          customerName: activeOrder.customer.name,
          deliveryAddress: activeOrder.customer.address,
          restaurantName: activeOrder.restaurant.name,
          restaurantId: activeOrder.restaurant.id,
          deliveryStatus: "delivered",
          pickupTime: new Date(),
          deliveryTime: new Date(),
          assignedTo: driverId,
          totalAmount: activeOrder.total,
          earnings: 300,
        }),
      });

      await fetch(`http://localhost:3008/api/orders/${activeOrder.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "delivered" }),
      });

      localStorage.removeItem("activeOrder");
      setActiveOrder(null);
      setRouteCoords([]);
      setPhase("idle");
      fetchHistory();
    } catch (error) {
      console.error("❌ Error completing delivery:", error);
    }
  };

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.text("Completed Deliveries", 10, 10);
    const tableData = deliveryHistory.map((d, i) => [
      i + 1,
      d.customerName,
      d.deliveryAddress,
      d.restaurantName,
      d.deliveryStatus,
      new Date(d.deliveryTime).toLocaleString(),
      `LKR ${d.earnings.toFixed(2)}`,
    ]);
    autoTable(doc, {
      head: [["#", "Customer", "Address", "Restaurant", "Status", "Delivered At", "Earnings"]],
      body: tableData,
      startY: 20,
    });
    doc.save("deliveries.pdf");
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const navItems = [
    { title: "Dashboard", href: "/dashboard", icon: "home" },
    { title: "Pending Deliveries", href: "/dashboard/delivery/pending-deliveries", icon: "truck" },
    { title: "Earnings", href: "/dashboard/delivery/earnings", icon: "dollar-sign" },
    { title: "Profile", href: "/dashboard/delivery", icon: "user" },
  ];

  const dailyDeliveriesData = deliveryHistory.reduce((acc: Record<string, number>, delivery) => {
    const date = new Date(delivery.deliveryTime).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(dailyDeliveriesData).map(([date, deliveries]) => ({
    date,
    deliveries,
  }));

  return (
    <DashboardLayout navItems={navItems}>
      <div className="p-6">
        <div className="flex justify-end mb-4">
          <div className="flex flex-col items-end">
            <div className="flex items-center text-3xl font-bold">
              <Clock className="h-7 w-7 mr-2" />
              {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
            </div>
            <span className="text-sm text-gray-500">{getGreeting()}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader><CardTitle>Today's Earnings</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold">LKR {(todayDeliveries * 300).toFixed(2)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total Deliveries</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold">{totalDeliveries}</CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active Delivery</TabsTrigger>
            <TabsTrigger value="history">Delivery History</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {activeOrder ? (
              <Card>
                <CardHeader><CardTitle>Active Delivery</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div><strong>Restaurant:</strong> {activeOrder.restaurant.name}</div>
                    <div><strong>Customer:</strong> {activeOrder.customer.name}</div>
                    <div><strong>Address:</strong> {activeOrder.customer.address}</div>
                  </div>

                  {driverLocation && <DeliveryMap driver={driverLocation} route={routeCoords} />}

                  <div className="flex flex-col gap-2 mt-4">
                    {phase === "idle" && (
                      <Button className="w-full bg-blue-500 text-white" onClick={handleAccept}>
                        <Truck className="mr-2" /> Accept Order
                      </Button>
                    )}
                    {phase === "going_to_restaurant" && (
                      <Button className="w-full bg-green-600 text-white" onClick={handlePickup}>
                        <MapPin className="mr-2" /> Picked Up
                      </Button>
                    )}
                    {phase === "going_to_customer" && (
                      <Button className="w-full bg-purple-600 text-white" onClick={completeDelivery}>
                        <CheckCircle className="mr-2" /> Complete Delivery
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader><CardTitle>No Active Delivery</CardTitle></CardHeader>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Button onClick={fetchHistory} className="mb-4 bg-orange-500 hover:bg-orange-600 text-white">
              Refresh
            </Button>
            <Button onClick={downloadPdf} className="mb-4 ml-2 bg-green-700 hover:bg-green-800 text-white">
              <Download className="mr-2" /> Download PDF
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deliveryHistory.map((d, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle>{d.customerName}</CardTitle>
                    <CardDescription>{new Date(d.deliveryTime).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div><strong>Address:</strong> {d.deliveryAddress}</div>
                    <div><strong>Restaurant:</strong> {d.restaurantName}</div>
                    <div><strong>Status:</strong> {d.deliveryStatus}</div>
                    <div><strong>Earnings:</strong> LKR {d.earnings.toFixed(2)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Daily Deliveries Overview</CardTitle>
              <CardDescription>Deliveries done per day</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="deliveries" stroke="#ef4444" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500">No data available.</p>
              )}
            </CardContent>
          </Card>
        </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
