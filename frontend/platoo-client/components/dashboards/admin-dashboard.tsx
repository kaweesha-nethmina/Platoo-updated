"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Users, Store, TruckIcon, BarChart3, Search, ArrowUpRight, ArrowDownRight, DollarSign, ShoppingBag } from 'lucide-react'

// Define types for stats and data objects
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  date: string;
}

interface Order {
  id: string;
  customer: string;
  restaurant: string;
  total: number;
  status: string;
  date: string;
}

interface Restaurant {
  id: string;
  name: string;
  owner: string;
  orders: number;
  rating: number;
  date: string;
}

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<{
    totalUsers: number;
    totalRestaurants: number;
    totalDeliveries: number;
    totalRevenue: number;
    recentUsers: User[];
    recentOrders: Order[];
    recentRestaurants: Restaurant[];
  }>({
    totalUsers: 0,
    totalRestaurants: 0,
    totalDeliveries: 0,
    totalRevenue: 0,
    recentUsers: [],
    recentOrders: [],
    recentRestaurants: []
  })

  useEffect(() => {
    // Simulate fetching admin data
    setTimeout(() => {
      setStats({
        totalUsers: 1248,
        totalRestaurants: 64,
        totalDeliveries: 892,
        totalRevenue: 28945.75,
        recentUsers: [
          { id: "USR-1001", name: "Sarah Johnson", email: "sarah.j@example.com", role: "user", date: "2023-04-15" },
          { id: "USR-1002", name: "Mike Chen", email: "mike.c@example.com", role: "restaurant_owner", date: "2023-04-14" },
          { id: "USR-1003", name: "Lisa Wong", email: "lisa.w@example.com", role: "delivery_man", date: "2023-04-13" },
          { id: "USR-1004", name: "David Smith", email: "david.s@example.com", role: "user", date: "2023-04-12" },
          { id: "USR-1005", name: "Emma Davis", email: "emma.d@example.com", role: "user", date: "2023-04-11" }
        ],
        recentOrders: [
          { id: "ORD-5001", customer: "John Doe", restaurant: "Burger Palace", total: 25.95, status: "delivered", date: "2023-04-15" },
          { id: "ORD-5002", customer: "Jane Smith", restaurant: "Pizza Heaven", total: 32.50, status: "out_for_delivery", date: "2023-04-15" },
          { id: "ORD-5003", customer: "Robert Johnson", restaurant: "Sushi Express", total: 45.80, status: "preparing", date: "2023-04-15" },
          { id: "ORD-5004", customer: "Emily Brown", restaurant: "Taco Time", total: 18.75, status: "pending", date: "2023-04-15" },
          { id: "ORD-5005", customer: "Michael Wilson", restaurant: "Pasta Place", total: 29.99, status: "delivered", date: "2023-04-14" }
        ],
        recentRestaurants: [
          { id: "RES-3001", name: "Burger Palace", owner: "Mike Chen", orders: 145, rating: 4.7, date: "2023-03-10" },
          { id: "RES-3002", name: "Pizza Heaven", owner: "Angela Martinez", orders: 210, rating: 4.5, date: "2023-03-05" },
          { id: "RES-3003", name: "Sushi Express", owner: "Takashi Yamamoto", orders: 98, rating: 4.8, date: "2023-03-15" },
          { id: "RES-3004", name: "Taco Time", owner: "Carlos Rodriguez", orders: 120, rating: 4.2, date: "2023-02-28" },
          { id: "RES-3005", name: "Pasta Place", owner: "Sophia Romano", orders: 87, rating: 4.6, date: "2023-03-20" }
        ]
      })
      setIsLoading(false)
    }, 1000)
  }, [])

  const navItems = [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Users", href: "/dashboard/admin/users", icon: "users" },
    { title: "Restaurants", href: "/dashboard/admin/restaurants", icon: "store" },
    { title: "Orders", href: "/dashboard/admin/orders", icon: "shopping-bag" },
    { title: "Delivery", href: "/dashboard/admin/delivery", icon: "truck" },
    { title: "Reports", href: "/dashboard/admin/reports", icon: "bar-chart-3" },
    { title: "Profile", href: "/dashboard/admin/profile", icon: "Profile" },
  ]

  const getRoleColor = (role: string) => {
    switch (role) {
      case "user": return "bg-blue-500"
      case "restaurant_owner": return "bg-orange-500"
      case "delivery_man": return "bg-green-500"
      case "admin": return "bg-purple-500"
      default: return "bg-gray-500"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500"
      case "preparing": return "bg-blue-500"
      case "out_for_delivery": return "bg-purple-500"
      case "delivered": return "bg-green-500"
      case "cancelled": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout navItems={navItems}>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          <span className="ml-2 text-lg">Loading admin dashboard...</span>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout navItems={navItems}>
      <div className="flex flex-col gap-6 p-4 md:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage your entire food ordering platform.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-500 flex items-center">
                  <ArrowUpRight className="mr-1 h-4 w-4" />
                  +12% from last month
                </span>
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Restaurants
              </CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRestaurants}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-500 flex items-center">
                  <ArrowUpRight className="mr-1 h-4 w-4" />
                  +5% from last month
                </span>
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Deliveries
              </CardTitle>
              <TruckIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDeliveries.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-red-500 flex items-center">
                  <ArrowDownRight className="mr-1 h-4 w-4" />
                  -3% from last month
                </span>
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-500 flex items-center">
                  <ArrowUpRight className="mr-1 h-4 w-4" />
                  +8% from last month
                </span>
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Recent Orders</CardTitle>
                  <CardDescription>
                    Latest orders across all restaurants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Restaurant</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recentOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.id}</TableCell>
                          <TableCell>{order.customer}</TableCell>
                          <TableCell>{order.restaurant}</TableCell>
                          <TableCell>${order.total.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(order.status)} text-white`}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{order.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm">View All Orders</Button>
                  </div>
                </CardContent>
              </Card>
              

              {/* Recent Users & Other Contents here */}
            </div>
          </TabsContent>

          {/* Add other TabsContents here for Users, Restaurants, Orders etc */}
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
