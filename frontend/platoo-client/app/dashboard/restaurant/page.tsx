"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface OrderItem {
  menu_item_id: string;
  quantity: number;
  price: number;
  _id: string;
}

interface Order {
  _id: string;
  order_id: string;
  user_id: string;
  total_amount: number;
  status: string;
  items: OrderItem[];
  restaurant_id: string;
  delivery_fee: number;
  delivery_address: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

function getDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(start: Date, end: Date) {
  const range = [];
  let current = new Date(start);
  while (current <= end) {
    range.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return range;
}

export default function OrderHistoryPage() {
  const ownerId = typeof window !== "undefined" ? localStorage.getItem("restaurantOwnerId") : null;
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyCounts, setDailyCounts] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });
  const [orderCount, setOrderCount] = useState(0);
  const [userOrderStats, setUserOrderStats] = useState<{ labels: string[]; data: number[]; topUsers: { email: string, count: number }[] }>({ labels: [], data: [], topUsers: [] });
  const [showOrderHistory, setShowOrderHistory] = useState(false); // NEW STATE

  useEffect(() => {
    if (!ownerId) return;
    const fetchRestaurants = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`http://localhost:3001/api/restaurants/owner/${ownerId}`);
        if (!response.ok) throw new Error("Failed to fetch restaurants");
        const data = await response.json();
        setRestaurants(data);
      } catch (error) {
        console.error("Error fetching restaurants:", error);
        setRestaurants([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRestaurants();
  }, [ownerId]);

  useEffect(() => {
    if (restaurants.length === 0) return;
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const ordersData: Order[] = [];
        for (const restaurant of restaurants) {
          const response = await fetch(`http://localhost:3008/api/orders?restaurant_id=${restaurant._id}`);
          if (!response.ok) throw new Error("Failed to fetch orders");
          const data = await response.json();
          ordersData.push(...data);
        }
        const filteredOrders = ordersData.filter((order: Order) => restaurants.some((restaurant) => restaurant._id === order.restaurant_id));
        setOrders(filteredOrders);
        setOrderCount(filteredOrders.length);

        const dates = filteredOrders.map((order: Order) => new Date(order.createdAt));
        if (dates.length === 0) {
          setDailyCounts({ labels: [], data: [] });
          setUserOrderStats({ labels: [], data: [], topUsers: [] });
          return;
        }
        dates.sort((a, b) => a.getTime() - b.getTime());
        const startDate = new Date(dates[0].toISOString().slice(0, 10));
        const endDate = new Date();
        const dateRange = getDateRange(startDate, endDate);
        const dateLabels = dateRange.map(getDateString);
        const counts: { [date: string]: number } = {};
        dateLabels.forEach(date => { counts[date] = 0 });
        filteredOrders.forEach((order: Order) => {
          const dateStr = getDateString(new Date(order.createdAt));
          if (counts[dateStr] !== undefined) counts[dateStr] += 1;
        });
        setDailyCounts({
          labels: dateLabels,
          data: dateLabels.map(date => counts[date]),
        });

        const userCounts: { [email: string]: number } = {};
        filteredOrders.forEach((order: Order) => {
          if (order.email) {
            userCounts[order.email] = (userCounts[order.email] || 0) + 1;
          }
        });
        const sortedUsers = Object.entries(userCounts)
          .sort((a, b) => b[1] - a[1]);
        const topUsers = sortedUsers.slice(0, 10).map(([email, count]) => ({ email, count }));
        setUserOrderStats({
          labels: topUsers.map(u => u.email),
          data: topUsers.map(u => u.count),
          topUsers: sortedUsers.slice(0, 5).map(([email, count]) => ({ email, count })),
        });
      } catch (error) {
        console.error("Error fetching orders:", error);
        setOrders([]);
        setOrderCount(0);
        setDailyCounts({ labels: [], data: [] });
        setUserOrderStats({ labels: [], data: [], topUsers: [] });
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, [restaurants]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "preparing":
        return "bg-blue-500";
      case "ready":
        return "bg-purple-500";
      case "out_for_delivery":
        return "bg-orange-500";
      case "delivered":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  // Orders Per Day (vertical bar)
  const chartData = {
    labels: dailyCounts.labels,
    datasets: [
      {
        label: "Number of Orders",
        data: dailyCounts.data,
        backgroundColor: "#6366f1",
        borderRadius: 8,
        barThickness: 36,
        maxBarThickness: 48,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: "Orders Per Day",
        font: { size: 26, weight: "bold" as const },
        color: "#111827",
        padding: { top: 20, bottom: 30 },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "#fff",
        titleColor: "#111827",
        bodyColor: "#111827",
        borderColor: "#6366f1",
        borderWidth: 1,
      },
    },
    layout: {
      padding: 24,
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Date",
          font: { size: 16, weight: "bold" as const },
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 18,
          font: { size: 14 },
        },
        grid: { display: false },
      },
      y: {
        title: {
          display: true,
          text: "Orders",
          font: { size: 16, weight: "bold" as const },
        },
        beginAtZero: true,
        precision: 0,
        ticks: { font: { size: 16 } },
        grid: { color: "#e5e7eb" },
      },
    },
  };

  // Usage Analytics (horizontal bar)
  const userChartData = {
    labels: userOrderStats.labels,
    datasets: [
      {
        label: "Orders per User",
        data: userOrderStats.data,
        backgroundColor: "#34d399",
        borderRadius: 8,
        barThickness: 28,
        maxBarThickness: 36,
        barPercentage: 0.5,
        categoryPercentage: 0.5,
      },
    ],
  };

  const userChartOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: "Usage Analytics",
        font: { size: 20, weight: "bold" as const },
        color: "#111827",
        padding: { top: 20, bottom: 30 },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "#fff",
        titleColor: "#111827",
        bodyColor: "#111827",
        borderColor: "#34d399",
        borderWidth: 1,
      },
    },
    layout: {
      padding: 24,
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Orders",
          font: { size: 16, weight: "bold" as const },
        },
        beginAtZero: true,
        precision: 0,
        ticks: { font: { size: 16 } },
        grid: { color: "#e5e7eb" },
      },
      y: {
        title: {
          display: true,
          text: "User Email",
          font: { size: 16, weight: "bold" as const },
        },
        ticks: {
          autoSkip: false,
          font: { size: 14 },
        },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-2 py-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Order History</h1>
        <p className="text-muted-foreground">
          All orders placed for this restaurant.
        </p>
        <div className="text-lg font-semibold mt-2">
          Total Orders: <span className="text-primary">{orderCount}</span>
        </div>
        {/* Show Order History Button */}
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-max"
          onClick={() => setShowOrderHistory((prev) => !prev)}
        >
          {showOrderHistory ? "Hide Order History" : "Show Order History"}
        </button>
      </div>

      {/* Orders Per Day Bar Graph */}
      <Card className="shadow-lg border border-gray-100">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Orders Per Day</CardTitle>
          <CardDescription>
            Track order volume trends over time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dailyCounts.labels.length === 0 ? (
            <div style={{ height: 440, display: "flex", alignItems: "center", justifyContent: "center" }}>No orders to display.</div>
          ) : (
            <div style={{ width: "100%", minWidth: 0, height: 440 }}>
              <Bar data={chartData} options={chartOptions} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Analytics Graph BELOW the bar graph */}
      <Card className="shadow-lg border border-gray-100">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Usage Analytics</CardTitle>
          <CardDescription>
            See your top users by total orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userOrderStats.labels.length === 0 ? (
            <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>No user analytics to display.</div>
          ) : (
            <>
              <div style={{ width: "100%", minWidth: 0, height: 340, marginBottom: 24 }}>
                <Bar data={userChartData} options={userChartOptions} />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Top 5 Users</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Orders</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userOrderStats.topUsers.map(user => (
                      <TableRow key={user.email}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Conditionally render the order history table */}
      {showOrderHistory && (
        <Card className="mt-6 shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle>Order History</CardTitle>
            <CardDescription>
              List of all orders for this restaurant
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div>Loading...</div>
            ) : orders.length === 0 ? (
              <div>No orders found for this restaurant.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Delivery Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map(order => (
                    <TableRow key={order._id}>
                      <TableCell>{order.order_id}</TableCell>
                      <TableCell>{order.email}</TableCell>
                      <TableCell>LKR{order.total_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(order.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{order.delivery_address}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
