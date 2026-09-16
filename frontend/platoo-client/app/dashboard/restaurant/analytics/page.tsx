"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  TooltipProps,
} from "recharts";


type Order = {
  _id: string;
  restaurant_id: string;
  createdAt: string;
  status: string;
  items: { menu_item_id: string; quantity: number }[];
};

type MenuItem = {
  _id: string;
  name: string;
  price: number;
  image_url?: string;
};

type MenuItemOrderStats = {
  _id: string;
  name: string;
  orders: number;
};

const STATUS_COLORS: Record<string, string> = {
  delivered: "#4ade80",
  preparing: "#fbbf24",
  cancelled: "#f87171",
  pending: "#60a5fa",
  // Add more statuses/colors as needed
};

// --- Custom Tooltip for BarChart ---
interface CustomTooltipProps extends TooltipProps<number, string> {
  menuItems: MenuItem[];
}
function CustomTooltip({ active, payload, menuItems }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const itemName = payload[0].payload.name;
    const menuItem = menuItems.find((item) => item.name === itemName);
    return (
      <div
        style={{
          background: "white",
          border: "1px solid #eee",
          borderRadius: 8,
          padding: 12,
          minWidth: 180,
          boxShadow: "0 3px 14px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: 8, fontWeight: 600 }}>{itemName}</div>
        {menuItem?.image_url && (
          <img
            src={menuItem.image_url}
            alt={itemName}
            style={{
              width: 80,
              height: 80,
              objectFit: "cover",
              borderRadius: 6,
              margin: "0 auto 8px auto",
              display: "block",
              background: "#f3f3f3",
            }}
          />
        )}
        <div style={{ color: "#6366f1", fontWeight: 500 }}>
          orders : {payload[0].value}
        </div>
      </div>
    );
  }
  return null;
}

export default function RestaurantAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);  // state to hold restaurantId

  useEffect(() => {
    const ownerId = localStorage.getItem("restaurantOwnerId");  // Fetch the ownerId from localStorage
    if (!ownerId) return;  // If no ownerId is available, exit

    const fetchRestaurantId = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/restaurants/owner/${ownerId}`);
        if (!response.ok) throw new Error("Failed to fetch restaurant data");
        const data = await response.json();
        
        if (data.length > 0) {
          const restaurant = data[0];
          setRestaurantId(restaurant._id); // Set the restaurantId from the fetched data
        } else {
          console.error("No restaurant found for this owner");
        }
      } catch (error) {
        console.error("Error fetching restaurant data:", error);
      }
    };

    fetchRestaurantId();
  }, []);

  useEffect(() => {
    if (!restaurantId) return; // If no restaurantId, don't fetch the data

    async function fetchData() {
      setLoading(true);
      let orderQuery = `?restaurant_id=${restaurantId}`;
      if (dateRange?.from) {
        orderQuery += `&start=${dateRange.from.toISOString()}`;
      }
      if (dateRange?.to) {
        orderQuery += `&end=${dateRange.to.toISOString()}`;
      }
      const ordersRes = await fetch(
        `http://localhost:3008/api/orders${orderQuery}`
      );
      const allOrders: Order[] = await ordersRes.json();

      const menuRes = await fetch(
        `http://localhost:3001/api/menu-items/restaurant/${restaurantId}`
      );
      const allMenuItems: MenuItem[] = await menuRes.json();

      // Extra frontend filtering by restaurant_id for safety
      const filteredOrders = allOrders.filter(
        (order) => order.restaurant_id === restaurantId
      );

      setOrders(filteredOrders);
      setMenuItems(allMenuItems);
      setLoading(false);
    }
    fetchData();
  }, [restaurantId, dateRange]);

  // Total orders for this restaurant only
  const totalOrders = orders.length;

  // Menu item order counts
  const menuItemOrderCounts: Record<string, number> = {};
  orders.forEach((order) => {
    order.items.forEach((item) => {
      menuItemOrderCounts[item.menu_item_id] =
        (menuItemOrderCounts[item.menu_item_id] || 0) + item.quantity;
    });
  });

  const menuItemStats: MenuItemOrderStats[] = menuItems.map((item) => ({
    _id: item._id,
    name: item.name,
    orders: menuItemOrderCounts[item._id] || 0,
  }));
  menuItemStats.sort((a, b) => b.orders - a.orders);

  // Pie Chart: Order status breakdown
  const statusCount: Record<string, number> = {};
  orders.forEach((order) => {
    statusCount[order.status] = (statusCount[order.status] || 0) + 1;
  });
  const statusData = Object.entries(statusCount).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    color: STATUS_COLORS[status] || "#a3a3a3",
  }));

  // Line Chart: Orders per day
  const ordersByDay: Record<string, number> = {};
  orders.forEach((order) => {
    const day = new Date(order.createdAt).toLocaleDateString();
    ordersByDay[day] = (ordersByDay[day] || 0) + 1;
  });
  const ordersByDayData = Object.entries(ordersByDay)
    .map(([date, count]) => ({ date, orders: count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Restaurant Orders Analytics</h1>
        <p className="text-muted-foreground">
          View total orders and menu item popularity for this restaurant.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span>
                {dateRange?.from && dateRange?.to
                  ? `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`
                  : "Select date range"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={dateRange}
              onSelect={setDateRange}
            />
          </PopoverContent>
        </Popover>
      </div>

      {loading ? (
        <div className="p-6">Loading...</div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Total Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders}</div>
                <div className="text-xs text-muted-foreground">
                  Orders placed for this restaurant
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="items" className="w-full mt-6">
            <TabsList>
              <TabsTrigger value="items">Menu Item Orders</TabsTrigger>
              <TabsTrigger value="barchart">Menu Bar Chart</TabsTrigger>
              <TabsTrigger value="orderstatus">Order Status Pie</TabsTrigger>
              <TabsTrigger value="ordertrend">Order Trend</TabsTrigger>
            </TabsList>

            <TabsContent value="items">
              <Card>
                <CardHeader>
                  <CardTitle>Orders per Menu Item</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {menuItemStats.map((item) => {
                      const menuItem = menuItems.find((m) => m._id === item._id);
                      return (
                        <div
                          key={item._id}
                          className="flex items-center justify-between border-b py-2"
                        >
                          <div className="flex items-center gap-3">
                            {menuItem?.image_url ? (
                              <img
                                src={menuItem.image_url}
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                                <span className="text-lg">{item.name.charAt(0)}</span>
                              </div>
                            )}
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <span className="text-right">{item.orders} orders</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="barchart">
              <Card>
                <CardHeader>
                  <CardTitle>Menu Item Orders Bar Chart</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ width: "100%", height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={menuItemStats}
                        margin={{ top: 20, right: 30, left: 0, bottom: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-30}
                          textAnchor="end"
                          interval={0}
                          height={80}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                          content={
                            // @ts-ignore
                            (props) => <CustomTooltip {...props} menuItems={menuItems} />
                          }
                        />
                        <Bar dataKey="orders" fill="#8884d8">
                          <LabelList dataKey="orders" position="top" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orderstatus">
              <Card>
                <CardHeader>
                  <CardTitle>Order Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ width: "100%", height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          label
                        >
                          {statusData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ordertrend">
              <Card>
                <CardHeader>
                  <CardTitle>Orders Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ width: "100%", height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ordersByDayData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" angle={-30} textAnchor="end" height={80} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="orders" stroke="#6366f1" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
