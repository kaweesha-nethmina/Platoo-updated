"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts"
import { Download, FileText, DollarSign, ShoppingBag, Store } from "lucide-react"

interface Order {
  date: string
  timestamp: number
  total: number
  amount: number
  restaurantId: string
  _id: string
  order_id: string
  user_id: string
  total_amount: number
  status: string
  items: any[]
  restaurant_id: string
  delivery_fee: number
  delivery_address: string
  phone: string
  email: string
  createdAt: string
  updatedAt: string
  restaurant?: string
}

interface Restaurant {
  id: string
  _id?: string
  name: string
  isActive?: boolean
  rating?: number
  createdAt?: string
}

interface RestaurantPerformanceData {
  restaurant: Restaurant
  orders: Order[]
  totalOrders: number
  totalRevenue: number
}

interface DateRange {
  from: Date
  to: Date
}

interface ChartData {
  name: string
  [key: string]: number | string
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"]

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), 0, 1),
    to: new Date(),
  })
  const [timeFrame, setTimeFrame] = useState<string>("yearly")
  const [orders, setOrders] = useState<Order[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [restaurantPerformance, setRestaurantPerformance] = useState<RestaurantPerformanceData[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        const restaurantsRes = await fetch("http://localhost:3001/api/restaurants")
        if (!restaurantsRes.ok) throw new Error("Failed to fetch restaurants")
        const restaurantsRaw = await restaurantsRes.json()
        const allRestaurants: Restaurant[] = Array.isArray(restaurantsRaw)
          ? restaurantsRaw.map((r: any) => ({
              id: r._id || r.id,
              name: r.name || "Unnamed Restaurant",
              isActive: r.isActive ?? true,
              rating: r.rating || 0,
              createdAt: r.createdAt || undefined,
            }))
          : []
        setRestaurants(allRestaurants)

        const ordersRes = await fetch("http://localhost:3008/api/orders")
        const ordersRaw = await ordersRes.json()
        const ordersData: Order[] = Array.isArray(ordersRaw)
          ? ordersRaw.map((order: any) => ({
              _id: order._id || "",
              order_id: order.order_id || "",
              user_id: order.user_id || "",
              total_amount: Number(order.total_amount) || 0,
              status: order.status || "",
              items: order.items || [],
              restaurant_id: order.restaurant_id || "",
              delivery_fee: Number(order.delivery_fee) || 0,
              delivery_address: order.delivery_address || "",
              phone: order.phone || "",
              email: order.email || "",
              createdAt: order.createdAt || "",
              updatedAt: order.updatedAt || "",
              restaurant: order.restaurant || "",
              date: order.createdAt ? new Date(order.createdAt).toISOString().split("T")[0] : "",
              timestamp: order.createdAt ? new Date(order.createdAt).getTime() : 0,
              total: order.total_amount || 0,
              amount: order.total_amount || 0,
              restaurantId: order.restaurant_id || "",
            }))
          : []
        setOrders(ordersData)

        const performanceData = allRestaurants.map(restaurant => {
          const restaurantOrders = ordersData.filter(o => o.restaurant_id === restaurant.id)
          return {
            restaurant,
            orders: restaurantOrders,
            totalOrders: restaurantOrders.length,
            totalRevenue: restaurantOrders.reduce((sum, o) => sum + o.total_amount, 0)
          }
        })
        setRestaurantPerformance(performanceData)
      } catch (error: any) {
        console.error("Error fetching dashboard data:", error)
        setError(error.message || "Failed to fetch data")
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  function filterOrdersByDateRange(orders: Order[], range: DateRange): Order[] {
    return orders.filter(o => {
      if (!o.createdAt) return false
      const d = new Date(o.createdAt)
      return d >= new Date(range.from.setHours(0,0,0,0)) && d <= new Date(range.to.setHours(23,59,59,999))
    })
  }

  function filterRestaurantsByDateRange(restaurants: Restaurant[], range: DateRange): Restaurant[] {
    return restaurants.filter(r => {
      if (!r.createdAt) return false
      const d = new Date(r.createdAt)
      return d >= new Date(range.from.setHours(0,0,0,0)) && d <= new Date(range.to.setHours(23,59,59,999))
    })
  }

  function getPreviousDateRange(currentRange: DateRange): DateRange {
    const diff = currentRange.to.getTime() - currentRange.from.getTime()
    const prevTo = new Date(currentRange.from.getTime() - 1)
    const prevFrom = new Date(prevTo.getTime() - diff)
    return { from: prevFrom, to: prevTo }
  }

  const filteredOrders = filterOrdersByDateRange(orders, dateRange)
  const filteredRestaurants = filterRestaurantsByDateRange(restaurants, dateRange)

  const totalRevenue = filteredOrders.reduce(
    (sum, o) => sum + Number(o.total_amount ?? 0),
    0
  )
  const totalOrders = filteredOrders.length
  const totalRestaurants = filteredRestaurants.length

  // Completed Orders: Delivered + Completed (case-insensitive)
  const completedOrders = filteredOrders.filter(
    o => o.status?.toLowerCase() === "delivered" || o.status?.toLowerCase() === "completed"
  ).length

  const cancelledOrders = filteredOrders.filter(
    o => o.status?.toLowerCase() === "cancelled"
  ).length

  const activeRestaurants = filteredRestaurants.filter(r => r.isActive !== false).length

  // Previous period calculations
  const previousDateRange = getPreviousDateRange(dateRange)
  const previousFilteredOrders = filterOrdersByDateRange(orders, previousDateRange)
  const previousFilteredRestaurants = filterRestaurantsByDateRange(restaurants, previousDateRange)
  const previousPeriodOrders = previousFilteredOrders.length
  const previousPeriodRevenue = previousFilteredOrders.reduce(
    (sum, o) => sum + Number(o.total_amount ?? 0),
    0
  )
  const previousPeriodRestaurants = previousFilteredRestaurants.length

  // Order Growth %
  let orderGrowth = 0
  if (previousPeriodOrders > 0) {
    orderGrowth = ((totalOrders - previousPeriodOrders) / previousPeriodOrders) * 100
  } else if (totalOrders > 0) {
    orderGrowth = 100
  } else {
    orderGrowth = 0
  }
  const orderGrowthDisplay = `${orderGrowth >= 0 ? "+" : ""}${orderGrowth.toFixed(1)}%`

  // Revenue Growth %
  let revenueGrowth = 0
  if (previousPeriodRevenue > 0) {
    revenueGrowth = ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
  } else if (totalRevenue > 0) {
    revenueGrowth = 100
  } else {
    revenueGrowth = 0
  }
  const revenueGrowthDisplay = `${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%`

  // Restaurant Growth %
  let restaurantGrowth = 0
  if (previousPeriodRestaurants > 0) {
    restaurantGrowth = ((totalRestaurants - previousPeriodRestaurants) / previousPeriodRestaurants) * 100
  } else if (totalRestaurants > 0) {
    restaurantGrowth = 100
  } else {
    restaurantGrowth = 0
  }
  const restaurantGrowthDisplay = `${restaurantGrowth >= 0 ? "+" : ""}${restaurantGrowth.toFixed(1)}%`

  // --- Chart Data Transformation (Filtered) ---
  function groupByMonth(
    data: Order[],
    valueKey: string,
    sumField?: keyof Order
  ): ChartData[] {
    const months: ChartData[] = Array.from({ length: 12 }, (_, i) => ({
      name: new Date(0, i).toLocaleString("default", { month: "short" }),
      [valueKey]: 0,
    }))
    data.forEach(item => {
      if (!item.createdAt) return
      const date = new Date(item.createdAt)
      if (!isNaN(date.getTime())) {
        const month = date.getMonth()
        if (sumField) {
          months[month][valueKey] = (months[month][valueKey] as number) + Number(item[sumField] ?? 0)
        } else {
          months[month][valueKey] = (months[month][valueKey] as number) + 1
        }
      }
    })
    return months
  }

  const revenueData = groupByMonth(filteredOrders, "revenue", "total_amount")
  const ordersData = groupByMonth(filteredOrders, "orders")

  // --- Restaurant Performance (Filtered) ---
  const restaurantPerformanceData = restaurantPerformance
    .sort((a, b) => b.totalOrders - a.totalOrders)
    .slice(0, 5)
    .map(r => ({
      name: r.restaurant.name,
      orders: r.totalOrders,
      revenue: r.totalRevenue
    }))

  // --- Order Status Pie (Filtered) ---
  const orderStatusCounts: Record<string, number> = {}
  filteredOrders.forEach(o => {
    const status = o.status ?? "Unknown"
    orderStatusCounts[status] = (orderStatusCounts[status] ?? 0) + 1
  })
  const orderStatusData = Object.entries(orderStatusCounts).map(([name, value]) => ({ name, value }))

  // --- Misc Metrics (Filtered) ---
  const avgOrderValue = totalOrders ? (totalRevenue / totalOrders) : 0
  const projectedRevenue = totalRevenue * 1.1
  const avgRestaurantRating =
    filteredRestaurants.length > 0
      ? (
          filteredRestaurants.reduce((sum, r) => sum + (r.rating ?? 0), 0) /
          filteredRestaurants.length
        ).toFixed(1)
      : "0.0"

  if (loading) return <div>Loading...</div>
  if (error) return <div>{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
        <p className="text-muted-foreground">View detailed analytics </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
          </TabsList>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-4">
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2"></div>
            </div>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">LKR{totalRevenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-500">{revenueGrowthDisplay}</span> from previous period
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-500">{orderGrowthDisplay}</span> from previous period
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Restaurants</CardTitle>
                  <Store className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalRestaurants.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-500">{restaurantGrowthDisplay}</span> from previous period
                  </p>
                </CardContent>
              </Card>
            </div>
            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>Monthly revenue for the current year</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => [`LKR ${value}`, "Revenue"]} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#ef4444"
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            {/* Orders Chart */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Order Status Distribution</CardTitle>
                  <CardDescription>Current order status breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={orderStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        >
                          {orderStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name, props) => [
                            value,
                            props.payload?.name || "Orders"
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend: status color, name, and percentage */}
                  <div className="flex flex-wrap gap-4 mt-6 justify-center">
                    {orderStatusData.map((entry, index) => {
                      const total = orderStatusData.reduce((sum, e) => sum + e.value, 0)
                      const percent = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0
                      return (
                        <div key={entry.name} className="flex items-center gap-2">
                          <span
                            style={{
                              display: 'inline-block',
                              width: 16,
                              height: 16,
                              backgroundColor: COLORS[index % COLORS.length],
                              borderRadius: '50%',
                            }}
                          />
                          <span className="text-sm">{entry.name}</span>
                          <span className="text-xs text-muted-foreground">({percent}%)</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* Top Restaurants */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Restaurants</CardTitle>
                <CardDescription>Based on order volume and revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={restaurantPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                      <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="orders" fill="#8884d8" name="Orders" />
                      <Bar yAxisId="right" dataKey="revenue" fill="#82ca9d" name="Revenue (LKR)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Analysis</CardTitle>
                <CardDescription>Detailed revenue breakdown and trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="colorRevenue2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => [`LKR ${value}`, "Revenue"]} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#ef4444"
                        fillOpacity={1}
                        fill="url(#colorRevenue2)"
                        name="Revenue (LKR)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
                      <div className="text-2xl font-bold">LKR{totalRevenue.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Average Order Value</div>
                      <div className="text-2xl font-bold">LKR{avgOrderValue.toFixed(2)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Revenue Growth %</div>
                      <div className="text-2xl font-bold text-green-500">{revenueGrowth}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Projected Revenue</div>
                      <div className="text-2xl font-bold">LKR{projectedRevenue.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Analysis</CardTitle>
                <CardDescription>Detailed order metrics and trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ordersData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="orders" stroke="#3b82f6" activeDot={{ r: 8 }} name="Orders" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Total Orders</div>
                      <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Completed Orders</div>
                      <div className="text-2xl font-bold">{completedOrders.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Cancelled Orders</div>
                      <div className="text-2xl font-bold">{cancelledOrders.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-muted-foreground">Order Growth %</div>
                      <div className="text-2xl font-bold text-green-500">{orderGrowth}</div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* Restaurants Tab */}
          <TabsContent value="restaurants" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Restaurant Performance</CardTitle>
                <CardDescription>Detailed metrics with order lists</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full min-h-[250px] h-[40vw] max-h-[450px] md:max-h-[500px] overflow-x-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={restaurantPerformanceData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                      <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="orders" fill="#8884d8" name="Orders" />
                      <Bar yAxisId="right" dataKey="revenue" fill="#82ca9d" name="Revenue (LKR)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {restaurantPerformance.map(({ restaurant, orders, totalOrders, totalRevenue }) => (
                    <div
                      key={restaurant.id}
                      className="border rounded p-4 bg-white shadow-sm flex flex-col h-full"
                      style={{ minWidth: 0 }}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-y-2 gap-x-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg truncate">{restaurant.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {totalOrders} orders • LKR {totalRevenue.toLocaleString()} revenue
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            restaurant.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {restaurant.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {/* --- PROFESSIONAL VIEW ORDERS LIST START --- */}
                      {orders.length > 0 && (
                        <details className="mt-4 group">
                          <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2 select-none">
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 group-open:rotate-90 transition-transform" />
                            <span>
                              View Orders <span className="opacity-60">({orders.length})</span>
                            </span>
                          </summary>
                          <ul className="mt-3 divide-y divide-gray-200 max-h-64 overflow-y-auto bg-gray-50 rounded-lg shadow-inner">
                            {orders.map((order) => (
                              <li key={order._id} className="py-3 px-4 flex items-center gap-4 hover:bg-blue-50 transition">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-base font-semibold text-gray-900">#{order.order_id}</span>
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium 
                                        ${order.status === "Delivered" || order.status === "Completed"
                                          ? "bg-green-100 text-green-700"
                                          : order.status === "Cancelled"
                                          ? "bg-red-100 text-red-700"
                                          : "bg-yellow-100 text-yellow-800"
                                        }`}
                                    >
                                      {order.status}
                                    </span>
                                    <span className="ml-2 text-xs text-gray-500">
                                      {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-700">
                                    <span>
                                      <span className="font-medium">Amount:</span> LKR {order.total_amount.toLocaleString()}
                                    </span>
                                    <span>
                                      <span className="font-medium">Items:</span> {order.items.length}
                                    </span>
                                    <span>
                                      <span className="font-medium">Customer:</span> {order.email || order.phone || "-"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end min-w-[72px]">
                                  <span className="text-xs text-gray-400">Order ID</span>
                                  <span className="text-xs text-gray-600">{order._id.slice(-6)}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
