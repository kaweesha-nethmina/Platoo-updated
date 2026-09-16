"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { jwtDecode } from "jwt-decode"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  LogOut,
  Search,
  HelpCircle,
  MessageSquare,
  Star,
  Tag,
  Package,
  DollarSign,
  Utensils,
  BarChart2,
  Settings,
} from "lucide-react"

interface JwtPayload {
  id: string
  role: string
  name?: string
  email?: string
  restaurantName?: string
  iat: number
  exp: number
}

export default function RestaurantDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [userData, setUserData] = useState<{
    id: string
    name: string
    email: string
    role: string
    restaurantName: string
  } | null>(null)
  const [notifications, setNotifications] = useState(3)
  const [totalOrders, setTotalOrders] = useState(0)

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async (token: string) => {
      try {
        const decoded = jwtDecode<JwtPayload>(token)
        const response = await fetch(
          `http://localhost:4000/api/auth/restaurant-owner/${decoded.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        )
        if (!response.ok) {
          throw new Error("Failed to fetch user data")
        }
        const userData = await response.json()
        setUserData({
          id: userData._id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          restaurantName: userData.restaurantName,
        })
      } catch (error) {
        console.error("Error fetching user data:", error)
        localStorage.removeItem("token")
        router.push("/login")
      } finally {
        setIsLoading(false)
      }
    }

    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }

    fetchUserData(token)
  }, [router])

  // Fetch ALL orders count for this restaurant
  useEffect(() => {
    const fetchOrdersCount = async () => {
      if (!userData?.id) return

      try {
        const token = localStorage.getItem("token")
        if (!token) {
          router.push("/login")
          return
        }

        const response = await fetch("http://localhost:3008/api/orders", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) throw new Error("Failed to fetch orders")

        const orders = await response.json()
        const restaurantOrders = orders.filter(
          (order: any) =>
            order.restaurant_id === userData.id // <-- use restaurant_id as per your backend
        )

        setTotalOrders(restaurantOrders.length)
      } catch (error) {
        console.error("Error fetching orders:", error)
      }
    }

    fetchOrdersCount()
  }, [userData?.id, router])

  const handleSignOut = () => {
    localStorage.removeItem("token")
    router.push("/login")
  }

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard/restaurant",
      icon: <LayoutDashboard className="h-5 w-5" />,
      badge: null,
    },
    {
      title: "Orders",
      href: "/dashboard/restaurant/orders",
      icon: <ShoppingBag className="h-5 w-5" />,
      
    },
    {
      title: "Menu",
      href: "/dashboard/restaurant/menu",
      icon: <Utensils className="h-5 w-5" />,
      badge: null,
    },
    {
      title: "Analytics",
      href: "/dashboard/restaurant/analytics",
      icon: <BarChart2 className="h-5 w-5" />,
      badge: null,
    },
    {
      title: "Settings",
      href: "/dashboard/restaurant/settings",
      icon: <Settings className="h-5 w-5" />,
      badge: null,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="mt-4 h-4 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <Sidebar>
          <SidebarHeader className="flex h-16 items-center border-b px-6">
            <Link href="/dashboard/restaurant" className="flex items-center gap-2 font-semibold">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500 text-white">
                <span className="text-lg font-bold">P</span>
              </div>
              <span className="text-lg font-bold">Platoo Restaurant</span>
            </Link>
          </SidebarHeader>

          <SidebarContent>
            <div className="px-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-9 bg-muted/50" />
              </div>
            </div>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.href ||
                      (pathname.startsWith(item.href) && item.href !== "/dashboard/restaurant")
                    }
                  >
                    <Link href={item.href} className="flex justify-between w-full">
                      <div className="flex items-center">
                        {item.icon}
                        <span>{item.title}</span>
                      </div>
                      
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>

            <SidebarSeparator className="my-4" />
            
          </SidebarContent>

          <SidebarFooter className="border-t p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="https://previews.123rf.com/images/valentint/valentint1704/valentint170400744/75401541-restaurant-icon-restaurant-website-button-on-white-background.jpg" alt={userData?.name || "Restaurant"} />
                  <AvatarFallback>{userData?.restaurantName?.charAt(0) || "R"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{userData?.restaurantName}</p>
                  <p className="text-xs text-muted-foreground">{userData?.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Sign out</span>
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <div className="flex flex-1 flex-col w-full">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-semibold">
                {navItems.find(
                  (item) =>
                    pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard/restaurant"),
                )?.title || "Restaurant Dashboard"}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              
              <div className="hidden md:flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://icons.veryicon.com/png/o/internet--web/prejudice/user-128.png" alt={userData?.name || "Restaurant"} />
                  <AvatarFallback>{userData?.name?.charAt(0) || "R"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{userData?.name}</p>
                  <p className="text-xs text-muted-foreground">Restaurant Manager</p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto ">
            <div className="container mx-auto p-6">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
