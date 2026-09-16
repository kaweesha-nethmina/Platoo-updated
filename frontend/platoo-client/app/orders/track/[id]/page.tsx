"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Clock, MapPin, Phone, MessageSquare, CheckCircle2, Truck, Package, ChevronLeft, User } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

export default function OrderTrackingPage() {
  const { id } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [currentStep, setCurrentStep] = useState(2)
  const [estimatedTime, setEstimatedTime] = useState("25-30 min")
  const [elapsedTime, setElapsedTime] = useState(0)

  // Simulate fetching order data
  useEffect(() => {
    const foundOrder = orders.find((o) => o.id === id)
    if (foundOrder) {
      setOrder(foundOrder)

      // Set current step based on status
      if (foundOrder.status === "Preparing") {
        setCurrentStep(1)
      } else if (foundOrder.status === "On the way") {
        setCurrentStep(2)
      } else if (foundOrder.status === "Delivered") {
        setCurrentStep(3)
      }
    }
  }, [id])

  // Simulate time passing for active orders
  useEffect(() => {
    if (!order || order.status === "Delivered" || order.status === "Cancelled") return

    const timer = setInterval(() => {
      setElapsedTime((prev) => {
        const newTime = prev + 1

        // Simulate order progress
        if (newTime === 10 && currentStep === 1) {
          setCurrentStep(2)
        } else if (newTime === 20 && currentStep === 2) {
          setCurrentStep(3)
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [order, currentStep])

  if (!order) {
    return (
      <div className="container py-8">
        <div className="flex justify-center items-center h-64">
          <p>Loading order details...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header cartCount={1}/>
      <div className="container py-8">
      <div className="flex flex-col gap-6">
        <Link href="/orders" className="flex items-center text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-4 w-4 mr-1" />
          <span>Back to Orders</span>
        </Link>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Track Order</h1>
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
          <p className="text-gray-500">
            Order #{order.id} • {order.date}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* Tracking Progress */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Delivery Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-orange-500">
                      <Clock className="h-5 w-5" />
                      <span className="font-medium">Estimated Delivery Time: {estimatedTime}</span>
                    </div>
                    {order.status !== "Delivered" && order.status !== "Cancelled" && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-500 border-orange-200">
                        In Progress
                      </Badge>
                    )}
                  </div>

                  <div className="relative">
                    {/* Progress Line */}
                    <div className="absolute top-5 left-5 h-[calc(100%-40px)] w-0.5 bg-gray-200"></div>

                    {/* Step 1: Order Confirmed */}
                    <div className="relative flex items-start mb-8">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          currentStep >= 0 ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                        } z-10`}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="ml-4">
                        <h3 className="font-medium">Order Confirmed</h3>
                        <p className="text-sm text-gray-500">Your order has been received</p>
                        <p className="text-xs text-gray-400 mt-1">Today, 12:30 PM</p>
                      </div>
                    </div>

                    {/* Step 2: Preparing */}
                    <div className="relative flex items-start mb-8">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          currentStep >= 1 ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                        } z-10`}
                      >
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="ml-4">
                        <h3 className="font-medium">Preparing Your Order</h3>
                        <p className="text-sm text-gray-500">The restaurant is preparing your food</p>
                        <p className="text-xs text-gray-400 mt-1">Today, 12:35 PM</p>
                      </div>
                    </div>

                    {/* Step 3: On the Way */}
                    <div className="relative flex items-start mb-8">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          currentStep >= 2 ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                        } z-10`}
                      >
                        <Truck className="h-5 w-5" />
                      </div>
                      <div className="ml-4">
                        <h3 className="font-medium">On the Way</h3>
                        <p className="text-sm text-gray-500">Your order is on its way to you</p>
                        {currentStep >= 2 && <p className="text-xs text-gray-400 mt-1">Today, 12:45 PM</p>}
                      </div>
                    </div>

                    {/* Step 4: Delivered */}
                    <div className="relative flex items-start">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          currentStep >= 3 ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                        } z-10`}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="ml-4">
                        <h3 className="font-medium">Delivered</h3>
                        <p className="text-sm text-gray-500">Enjoy your meal!</p>
                        {currentStep >= 3 && <p className="text-xs text-gray-400 mt-1">Today, 1:00 PM</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Details */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Delivery Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Delivery Address</p>
                      <p className="text-gray-500">{order.address}</p>
                    </div>
                  </div>

                  {order.status === "On the way" && (
                    <div className="flex items-start gap-2">
                      <User className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Delivery Person</p>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-2">
                            <div className="relative w-10 h-10 rounded-full overflow-hidden">
                              <Image
                                src="/placeholder.svg?height=40&width=40"
                                alt="Delivery Person"
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Michael Rodriguez</p>
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-orange-500 text-orange-500" />
                                <span className="text-xs text-gray-500">4.9</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-9 w-9 p-0">
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-9 w-9 p-0">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Restaurant Details */}
            <Card>
              <CardHeader>
                <CardTitle>Restaurant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                    <Image
                      src={order.restaurantImage || "/placeholder.svg"}
                      alt={order.restaurantName}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-medium">{order.restaurantName}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Star className="h-3 w-3 fill-orange-500 text-orange-500" />
                      <span>{order.restaurantRating}</span>
                    </div>
                    <Button size="sm" variant="link" className="p-0 h-auto text-orange-500">
                      View Restaurant
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            {/* Order Summary */}
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-500">
                        {item.quantity}x {item.name}
                      </span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span>${(order.total - 2.99 - order.total * 0.08).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Delivery Fee</span>
                    <span>$2.99</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tax</span>
                    <span>${(order.total * 0.08).toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>${order.total.toFixed(2)}</span>
                  </div>

                  <div className="pt-2">
                    <p className="text-sm text-gray-500 mb-2">Payment Method</p>
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-100 p-1 rounded">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <span className="text-sm">•••• •••• •••• 4242</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </div>
  )
}

// Icons
const Star = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const CreditCard = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
)

interface OrderItem {
  name: string
  quantity: number
  price: number
}

interface Order {
  id: string
  date: string
  status: "Preparing" | "On the way" | "Delivered" | "Cancelled"
  items: OrderItem[]
  address: string
  deliveryTime: string
  total: number
  restaurantName: string
  restaurantImage: string
  restaurantRating: number
}

const orders: Order[] = [
  {
    id: "ORD-7829",
    date: "March 20, 2025 - 12:30 PM",
    status: "Preparing",
    items: [
      { name: "Margherita Pizza", quantity: 1, price: 12.99 },
      { name: "Chicken Biryani", quantity: 1, price: 14.99 },
    ],
    address: "123 Main St, Apt 4B, New York, NY 10001",
    deliveryTime: "Today, 1:00 PM - 1:30 PM",
    total: 30.97,
    restaurantName: "Pizza Palace",
    restaurantImage: "/placeholder.svg?height=300&width=500",
    restaurantRating: 4.8,
  },
  {
    id: "ORD-7830",
    date: "March 20, 2025 - 1:15 PM",
    status: "On the way",
    items: [
      { name: "Beef Burger", quantity: 2, price: 9.99 },
      { name: "French Fries", quantity: 1, price: 3.99 },
      { name: "Chocolate Milkshake", quantity: 2, price: 4.99 },
    ],
    address: "456 Park Ave, Suite 10, New York, NY 10022",
    deliveryTime: "Today, 1:45 PM - 2:15 PM",
    total: 38.94,
    restaurantName: "Burger Barn",
    restaurantImage: "/placeholder.svg?height=300&width=500",
    restaurantRating: 4.5,
  },
  {
    id: "ORD-7801",
    date: "March 18, 2025 - 7:45 PM",
    status: "Delivered",
    items: [
      { name: "Vegetable Curry", quantity: 1, price: 13.99 },
      { name: "Garlic Naan", quantity: 2, price: 2.99 },
      { name: "Mango Lassi", quantity: 1, price: 3.99 },
    ],
    address: "123 Main St, Apt 4B, New York, NY 10001",
    deliveryTime: "Delivered at 8:20 PM",
    total: 23.96,
    restaurantName: "Curry House",
    restaurantImage: "/placeholder.svg?height=300&width=500",
    restaurantRating: 4.6,
  },
]
