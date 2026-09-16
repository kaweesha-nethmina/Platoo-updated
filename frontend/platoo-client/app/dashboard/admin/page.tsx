"use client"

import { useState, useEffect } from "react"
import { FiEye, FiEyeOff } from "react-icons/fi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts"
import { Users, Store, ShoppingBag, DollarSign, ArrowUpRight } from "lucide-react"
import { Bar as ChartBar } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend)

// Define types for the data objects
interface OrderItem {
  menu_item_id: string
  quantity: number
  price: number
  _id: string
}

interface Order {
  _id: string
  order_id: string
  user_id: string
  total_amount: number
  status: string
  items: OrderItem[]
  restaurant_id: string
  delivery_fee: number
  delivery_address: string
  phone: string
  email: string
  createdAt: string
  updatedAt: string
}

interface User {
  id: string
  name: string
  email: string
  role: string
  date: string
}

interface Restaurant {
  id: string
  name: string
  owner: string
  status: string
  date: string
}

interface DashboardData {
  totalUsers: number
  totalRestaurants: number
  totalOrders: number
  totalRevenue: number
  activeDeliveries: number
  recentOrders: Order[]
  recentUsers: User[]
  pendingRestaurants: Restaurant[]
}

export default function AdminDashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalUsers: 0,
    totalRestaurants: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeDeliveries: 0,
    recentOrders: [],
    recentUsers: [],
    pendingRestaurants: [],
  })
  const [revenueData, setRevenueData] = useState<{ name: string; revenue: number }[]>([])

  // Admin profile state
  const [isAdminProfileLoading, setIsAdminProfileLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [owner, setOwner] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    restaurantName: "",
  })

  // Password change states
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [password, setPassword] = useState("")

  // Delete account states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const fetchTotalUsers = async () => {
      try {
        const token = localStorage.getItem("token")
        const res = await fetch("http://localhost:4000/api/auth/users", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
        if (!res.ok) throw new Error("Failed to fetch users")
        const data = await res.json()
        setDashboardData((prev) => ({
          ...prev,
          totalUsers: Array.isArray(data) ? data.length : 0,
        }))
      } catch (error) {
        console.error("Error fetching total users:", error)
        setDashboardData((prev) => ({
          ...prev,
          totalUsers: 0,
        }))
      }
    }
    fetchTotalUsers()
  }, [])

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true)
      try {
        // Fetch orders and restaurants from endpoints
        const [ordersRes, restaurantsRes] = await Promise.all([
          fetch("http://localhost:3008/api/orders"),
          fetch("http://localhost:3001/api/restaurants"),
        ])
        const ordersRaw = await ordersRes.json()
        const restaurantsData = await restaurantsRes.json()

        // Map/transform orders to fit the updated Order interface
        const ordersData: Order[] = Array.isArray(ordersRaw)
          ? ordersRaw.map((order: any) => ({
              _id: order._id || "",
              order_id: order.order_id || "",
              user_id: order.user_id || "",
              total_amount: typeof order.total_amount === "number" ? order.total_amount : Number(order.total_amount) || 0,
              status: order.status || "",
              items: order.items || [],
              restaurant_id: order.restaurant_id || "",
              delivery_fee: typeof order.delivery_fee === "number" ? order.delivery_fee : Number(order.delivery_fee) || 0,
              delivery_address: order.delivery_address || "",
              phone: order.phone || "",
              email: order.email || "",
              createdAt: order.createdAt || "",
              updatedAt: order.updatedAt || "",
            }))
          : []

        // Calculate total revenue (sum of total_amount for all orders)
        const totalRevenue = ordersData.reduce((sum, order) => sum + (order.total_amount || 0), 0)

        // Group revenue by month for the current year
        const now = new Date()
        const year = now.getFullYear()
        const monthlyRevenue: { [month: string]: number } = {}
        for (let i = 0; i < 12; i++) {
          const monthName = new Date(year, i).toLocaleString("default", { month: "short" })
          monthlyRevenue[monthName] = 0
        }
        ordersData.forEach((order) => {
          const date = new Date(order.createdAt)
          if (date.getFullYear() === year) {
            const monthName = date.toLocaleString("default", { month: "short" })
            monthlyRevenue[monthName] += order.total_amount || 0
          }
        })
        const revenueDataArr = Object.entries(monthlyRevenue).map(([name, revenue]) => ({ name, revenue }))

        setDashboardData((prev) => ({
          ...prev,
          totalOrders: ordersData.length,
          totalRestaurants: Array.isArray(restaurantsData) ? restaurantsData.length : 0,
          totalRevenue: totalRevenue,
          activeDeliveries: 87,
          recentOrders: ordersData,
          recentUsers: prev.recentUsers,
          pendingRestaurants: prev.pendingRestaurants,
        }))
        setRevenueData(revenueDataArr)
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  

  // Simulate fetching admin profile (replace with real API as needed)
  useEffect(() => {
    const fetchAdminProfile = async () => {
      setIsAdminProfileLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("No authentication token found");
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        const userId = decodedToken.id;
        const response = await fetch(`http://localhost:4000/api/auth/user/${userId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const userData = await response.json();
        if (userData.role !== 'admin') {
          throw new Error("User is not an admin");
        }
        setOwner({
          name: userData.name || "",
          email: userData.email || "",
          phone: userData.phone || "",
          address: userData.address || "",
          restaurantName: userData.restaurantName || ""
        });
      } catch (error) {
        console.error("Error fetching admin profile:", error);
      } finally {
        setIsAdminProfileLoading(false);
      }
    };
    fetchAdminProfile();
  }, []);

  
  const handleSaveOwner = async () => {
    // Password validation
    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        setPasswordError("Password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("Passwords do not match.");
        return;
      }
    }
    setPasswordError("");
  
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const decodedToken = JSON.parse(atob(token.split('.')[1]));
      const userId = decodedToken.id;
  
      // Build payload for update
      const payload: any = {
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        address: owner.address,
        restaurantName: owner.restaurantName,
      };
      if (newPassword) {
        payload.password = newPassword;
      }
  
      const response = await fetch(`http://localhost:4000/api/auth/update/${userId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
  
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Update failed");
  
      // Determine if email or password was changed
      const emailChanged = data.email && data.email !== owner.email;
      const passwordChanged = !!newPassword;
  
      setIsEditing(false);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Profile updated successfully");
  
      if (emailChanged || passwordChanged) {
        localStorage.removeItem("token");
        toast.success(
          emailChanged
            ? "Email changed. Please log in again."
            : "Password changed. Please log in again."
        );
        window.location.href = "/login";
        return;
      }
  
      // Update localStorage with new user data (if you store user info)
      localStorage.setItem("user", JSON.stringify({
        ...data,
        id: userId
      }));
  
      setOwner({
        name: data.name ?? owner.name,
        email: data.email ?? owner.email,
        phone: data.phone ?? owner.phone,
        address: data.address ?? owner.address,
        restaurantName: data.restaurantName ?? owner.restaurantName
      });
    } catch (error) {
      console.error("Update error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    }
  };
  
  
 // Delete admin account handler
 const handleDeleteAccount = async () => {
  setIsDeleting(true)
  try {
    const token = localStorage.getItem("token")
    if (!token) throw new Error("No authentication token found")
    const decodedToken = JSON.parse(atob(token.split('.')[1]))
    const userId = decodedToken.id
    const response = await fetch(`http://localhost:4000/api/auth/delete/${userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.message || "Failed to delete account")
    }
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    toast.success("Account deleted successfully. Logging out...")
    setTimeout(() => {
      window.location.href = "/login"
    }, 1500)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to delete account")
  } finally {
    setIsDeleting(false)
    setShowDeleteConfirm(false)
  }
}

  
  

  // Status color helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500"
      case "preparing":
        return "bg-blue-500"
      case "out_for_delivery":
        return "bg-purple-500"
      case "delivered":
        return "bg-green-500"
      case "cancelled":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="admin-profile">Admin Profile</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab Content */}
        <TabsContent value="dashboard">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">Welcome to the Platoo admin dashboard. Here's what's happening today.</p>
          </div>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.totalUsers.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Restaurants</CardTitle>
                <Store className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.totalRestaurants}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.totalOrders.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">LKR{dashboardData.totalRevenue.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>Monthly revenue for the current year</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => [`LKR${value}`, "Revenue"]} />
                      <Bar dataKey="revenue" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* New Order History Section */}
          <OrderHistoryPage />
        </TabsContent>

        {/* Admin Profile Tab */}
        <TabsContent value="admin-profile" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Admin Profile</CardTitle>
              <CardDescription>Manage admin information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAdminProfileLoading ? (
                <div>Loading owner info...</div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="admin-name">Admin Name</Label>
                    <Input
                      id="admin-name"
                      value={owner.name}
                      onChange={e => setOwner({ ...owner, name: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-email">Admin Email</Label>
                    <Input
                      id="owner-email"
                      value={owner.email}
                      onChange={e => setOwner({ ...owner, email: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-phone">Admin Phone</Label>
                    <Input
                      id="owner-phone"
                      value={owner.phone}
                      onChange={e => setOwner({ ...owner, phone: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-address">Admin Address</Label>
                    <Input
                      id="owner-address"
                      value={owner.address}
                      onChange={e => setOwner({ ...owner, address: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  {isEditing && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <div style={{ position: "relative" }}>
                          <Input
                            id="new-password"
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(prev => !prev)}
                            style={{
                              position: "absolute",
                              right: 10,
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              display: "flex",
                              alignItems: "center"
                            }}
                            tabIndex={-1}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input
                          id="confirm-password"
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                        />
                      </div>
                      {passwordError && (
                        <div className="text-red-500 text-sm">{passwordError}</div>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-end gap-4">
              {isEditing ? (
                <Button onClick={handleSaveOwner}>Save Changes</Button>
              ) : (
                <>
                  <Button onClick={() => setIsEditing(true)}>Edit</Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting}
                  >
                    Delete Account
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>
          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
                <h2 className="text-lg font-bold mb-2">Delete Account?</h2>
                <p className="mb-4 text-sm text-gray-600">
                  Are you sure you want to delete your admin account? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Yes, Delete"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// OrderHistoryPage and helpers remain unchanged from your original code
function OrderHistoryPage() {
  const restaurantId = "68035d30a05864216cc9dd25"
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dailyCounts, setDailyCounts] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] })

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`http://localhost:3008/api/orders?restaurant_id=${restaurantId}`)
        if (!response.ok) throw new Error("Failed to fetch orders")
        const data = await response.json()
        setOrders(data)

        // Parse all order dates
        const dates = data.map((order: Order) => new Date(order.createdAt))
        if (dates.length === 0) {
          setDailyCounts({ labels: [], data: [] })
          return
        }

        // Find first and last date
        dates.sort((a: { getTime: () => number }, b: { getTime: () => number }) => a.getTime() - b.getTime())
        const startDate = new Date(dates[0].toISOString().slice(0, 10))
        const endDate = new Date() // today

        // Build date range
        const dateRange = getDateRange(startDate, endDate)
        const dateLabels = dateRange.map(getDateString)

        // Count orders per day
        const counts: { [date: string]: number } = {}
        dateLabels.forEach((date) => {
          counts[date] = 0
        })
        data.forEach((order: Order) => {
          const dateStr = getDateString(new Date(order.createdAt))
          if (counts[dateStr] !== undefined) counts[dateStr] += 1
        })

        setDailyCounts({
          labels: dateLabels,
          data: dateLabels.map((date) => counts[date]),
        })
      } catch (error) {
        console.error("Error fetching orders:", error)
        setOrders([])
        setDailyCounts({ labels: [], data: [] })
      } finally {
        setIsLoading(false)
      }
    }
    fetchOrders()
  }, [restaurantId])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500"
      case "preparing":
        return "bg-blue-500"
      case "ready":
        return "bg-purple-500"
      case "out_for_delivery":
        return "bg-orange-500"
      case "delivered":
        return "bg-green-500"
      case "cancelled":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  // Chart data for orders per day since first order
  const chartData = {
    labels: dailyCounts.labels,
    datasets: [
      {
        label: "Number of Orders",
        data: dailyCounts.data,
        backgroundColor: "#6366f1",
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Orders Placed Per Day (Since First Order)" },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 15,
        },
      },
      y: { beginAtZero: true, precision: 0 },
    },
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Order History</h1>
        <p className="text-muted-foreground">All orders placed for restaurant.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders Per Day (Since First Order)</CardTitle>
          <CardDescription>
            Number of orders placed each day from your first order to today
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dailyCounts.labels.length === 0 ? (
            <div>No orders to display.</div>
          ) : (
            <div style={{ maxWidth: 900 }}>
              <ChartBar data={chartData} options={chartOptions} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
          <CardDescription>List of all orders for restaurants</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : orders.length === 0 ? (
            <div>No orders found for this restaurant. </div>
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
                {orders.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell>{order.order_id}</TableCell>
                    <TableCell>{order.email}</TableCell>
                    <TableCell>LKR{order.total_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{order.delivery_address}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function getDateString(date: Date) {
  // Returns YYYY-MM-DD
  return date.toISOString().slice(0, 10)
}

function getDateRange(start: Date, end: Date) {
  // Returns array of Date objects from start to end (inclusive)
  const range = []
  let current = new Date(start)
  while (current <= end) {
    range.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return range
}
