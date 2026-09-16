"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, Receipt, ExternalLink } from "lucide-react"
import Link from "next/link"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useCart } from "@/hooks/useCart";
// Interface definitions for order and order items
interface OrderItem {
  name: string
  quantity: number
  price: number
}

interface Order {
  id: string
  date: string
  status: "pending" | "Preparing" | "On the way" | "Delivered" | "Cancelled"
  items: OrderItem[]
  address: string
  estimatedDelivery: string
  total: number
}
const {
  cartItems,
  isLoading,
  updateQuantity,
  removeItem,
  subtotal,
  deliveryFee,
  tax,
  total,
} = useCart();
export default function OrdersPage() {
  const [activeOrders, setActiveOrders] = useState<Order[]>([])
  const [completedOrders, setCompletedOrders] = useState<Order[]>([])
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  
  const loggedInUserId = localStorage.getItem("userId"); // Retrieve the logged-in user's ID

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch("http://localhost:3008/api/orders")
        if (!response.ok) {
          throw new Error("Failed to fetch orders")
        }
        const orders = await response.json()

        // Map the fetched orders to match the expected format and filter by logged-in user ID
        const mappedOrders: Order[] = orders
          .filter((order: any) => order.user_id === loggedInUserId) // Only show orders for the logged-in user
          .map((order: any) => ({
            id: order.order_id,
            date: new Date(order.createdAt).toLocaleString(), // Formatting date
            status: order.status,
            items: order.items.map((item: any) => ({
              name: item.menu_item_id, // You might want to replace this with the actual item name from your database
              quantity: item.quantity,
              price: item.price,
            })),
            address: order.delivery_address,
            estimatedDelivery: "TBD", // You can set a real value here if available
            total: order.total_amount + order.delivery_fee,
          }))

        // Categorize orders based on their status
        setActiveOrders(mappedOrders.filter((order) => order.status === "pending"))
        setCompletedOrders(mappedOrders.filter((order) => order.status === "Delivered"))
        setCancelledOrders(mappedOrders.filter((order) => order.status === "Cancelled"))
      } catch (error) {
        console.error("Error fetching orders:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
  }, [loggedInUserId]) // Re-run this effect if the user ID changes

  if (isLoading) {
    return (
      <div>
        <Header cartCount={cartItems.length} />
        <div className="flex justify-center items-center h-[50vh]">
          <p className="text-gray-500">Loading orders...</p>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div>
      <Header cartCount={cartItems.length} />
      <div className="container py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">My Orders</h1>
            <p className="text-gray-500">Track and manage your orders</p>
          </div>

          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active Orders</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
            <div className="mt-6">
              <TabsContent value="active" className="space-y-4">
                {activeOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </TabsContent>
              <TabsContent value="completed" className="space-y-4">
                {completedOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </TabsContent>
              <TabsContent value="cancelled" className="space-y-4">
                {cancelledOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  )
}

function OrderCard({ order }: { order: Order }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">Order #{order.id}</CardTitle>
            <p className="text-sm text-gray-500">{order.date}</p>
          </div>
          <Badge
            className={
              order.status === "Delivered"
                ? "bg-green-500"
                : order.status === "Cancelled"
                ? "bg-red-500"
                : "bg-orange-500"
            }
          >
            {order.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <Receipt className="h-4 w-4 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium">Order Items</p>
                <ul className="text-sm text-gray-500">
                  {order.items.map((item, index) => (
                    <li key={index}>
                      {item.quantity}x {item.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium">Delivery Address</p>
                <p className="text-sm text-gray-500">{order.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium">Estimated Delivery</p>
                <p className="text-sm text-gray-500">{order.estimatedDelivery}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <p className="font-semibold">Total: ${order.total.toFixed(2)}</p>
            <Link href={`/orders/${order.id}`}>
              <Button variant="outline" size="sm">
                View Details
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
