"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Order {
  id: string;
  customer: { name: string; address: string; latitude: number; longitude: number };
  restaurant: { id: string; name: string; latitude: number; longitude: number };
  items: { menu_item_id: string; quantity: number; price: number }[];
  total: string;
  status: string;
  time: string;
  payment: string;
  delivery: string;
}

export default function PendingDeliveriesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const router = useRouter();

  const driverId = typeof window !== "undefined" ? localStorage.getItem("deliveryManId") || "driver-123" : "driver-123";

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:3008/api/orders");
      const data = await res.json();

      const readyOrders = data.filter((o: any) => o.status === "ready");

      const mapped = await Promise.all(
        readyOrders.map(async (o: any) => {
          const restRes = await fetch(`http://localhost:3001/api/restaurants/${o.restaurant_id}`);
          const rest = await restRes.json();

          return {
            id: o.order_id,
            customer: {
              name: o.email?.split("@")[0] || "Customer",
              address: o.delivery_address || "N/A",
              latitude: o.location?.lat,
              longitude: o.location?.lng,
              
            },
            restaurant: {
              id: o.restaurant_id,
              name: rest.name || "Unknown Restaurant",
              latitude: rest.location?.coordinates[1],
              longitude: rest.location?.coordinates[0],
            },
            items: o.items,
            total: o.total_amount.toFixed(2),
            status: o.status,
            time: new Date(o.createdAt).toLocaleString(),
            payment: "Online",
            delivery: "Delivery",
          };
        })
      );

      setOrders(mapped);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptDelivery = (order: Order) => {
    const driverLat = localStorage.getItem("driverLatitude");
    const driverLng = localStorage.getItem("driverLongitude");

    if (!driverLat || !driverLng) {
      console.error("❌ Driver location not available in localStorage!");
      return;
    }

    const updatedOrder = {
      ...order,
      driverLocation: {
        lat: parseFloat(driverLat),
        lng: parseFloat(driverLng),
      },
    };

    localStorage.setItem("activeOrder", JSON.stringify(updatedOrder));
    console.log("✅ Active order with driver location saved:", updatedOrder);
    router.push("/dashboard");
  };

  const toggleRow = (id: string) => setExpandedRow((prev) => (prev === id ? null : id));

  const navItems = [
    { title: "Dashboard", href: "/dashboard", icon: "home" },
    { title: "Pending Deliveries", href: "/dashboard/delivery/pending-deliveries", icon: "truck" },
    { title: "Earnings", href: "/dashboard/delivery/earnings", icon: "dollar-sign" },
    { title: "Profile", href: "/dashboard/delivery", icon: "user" },
  ];

  return (
    <DashboardLayout navItems={navItems}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Pending Deliveries</h1>
          <Button variant="default" onClick={fetchOrders}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : (
          <Card>
            <CardHeader><CardTitle>Ready Orders</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <>
                      <TableRow key={order.id}>
                        <TableCell>{order.id}</TableCell>
                        <TableCell>{order.customer.name}</TableCell>
                        <TableCell>{order.restaurant.name}</TableCell>
                        <TableCell>LKR {order.total}</TableCell>
                        <TableCell>{order.time}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" onClick={() => toggleRow(order.id)}>
                            {expandedRow === order.id ? "Hide Items" : "View Items"}
                          </Button>
                          <Button onClick={() => handleAcceptDelivery(order)}>Accept</Button>
                        </TableCell>
                      </TableRow>
                      {expandedRow === order.id && (
                        <TableRow key={`${order.id}-items`}>
                          <TableCell colSpan={6}>
                            <ul className="list-disc list-inside">
                              {order.items.map((item, idx) => (
                                <li key={idx}>
                                  {item.quantity}x Item – LKR {item.price.toFixed(2)}
                                </li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
