"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { jwtDecode } from "jwt-decode"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
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
  Settings,
  Bell,
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
  const [pendingOrders, setPendingOrders] = useState(5)

  const hasCheckedAuth = useRef(false) // This ref will track if we've already checked authentication

  useEffect(() => {
    // Ensure we only check authentication once, especially on fast refresh
    if (hasCheckedAuth.current) return // If we have already checked authentication, skip this effect
    hasCheckedAuth.current = true

    // Check if user is authenticated and is a restaurant owner/manager
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/login")
      return
    }

    try {
      // Decode the JWT token to get user role
      const decoded = jwtDecode<JwtPayload>(token)

      if (decoded.role !== "restaurant") {
        // Redirect non-restaurant users
        router.push("/dashboard")
        return
      }

      setUserData({
        id: decoded.id,
        name: decoded.name || "Restaurant Manager",
        email: decoded.email || "restaurant@example.com",
        role: decoded.role,
        restaurantName: decoded.restaurantName || "Burger Palace",
      })
    } catch (error) {
      console.error("Invalid token:", error)
      localStorage.removeItem("token")
      router.push("/login")
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const handleSignOut = () => {
    localStorage.removeItem("token")
    router.push("/login")
  }

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard/restaurant",
      icon: <LayoutDashboard className="h-5 w-5" /> ,
      badge: null,
    },
    {
      title: "Orders",
      href: "/dashboard/restaurant/orders",
      icon: <ShoppingBag className="h-5 w-5" />,
      badge: { count: pendingOrders, variant: "default" },
    },
    {
      title: "Menu",
      href: "/dashboard/restaurant/menu",
      icon: <Utensils className="h-5 w-5" /> ,
      badge: null,
    },
    {
      title: "Reviews",
      href: "/dashboard/restaurant/reviews",
      icon: <Star className="h-5 w-5" />,
      badge: null,
    },
    {
      title: "Promotions",
      href: "/dashboard/restaurant/promotions",
      icon: <Tag className="h-5 w-5" />,
      badge: null,
    },
    {
      title: "Inventory",
      href: "/dashboard/restaurant/inventory",
      icon: <Package className="h-5 w-5" />,
      badge: null,
    },
    {
      title: "Finances",
      href: "/dashboard/restaurant/finances",
      icon: <DollarSign className="h-5 w-5" />,
      badge: null,
    },
    {
      title: "Employees",
      href: "/dashboard/restaurant/employees",
      icon: <Users className="h-5 w-5" />,
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
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href} className="flex justify-between w-full">
                      <div className="flex items-center">
                        {item.icon}
                        <span>{item.title}</span>
                      </div>
                      {item.badge && <Badge className="ml-auto bg-orange-500 text-white">{item.badge.count}</Badge>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>

            <SidebarSeparator className="my-4" />

            <div className="px-4 py-2">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">Support</h3>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/restaurant/help">
                      <HelpCircle className="h-5 w-5" />
                      <span>Help Center</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/restaurant/messages">
                      <MessageSquare className="h-5 w-5" />
                      <span>Messages</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </SidebarContent>

          <SidebarFooter className="border-t p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="/placeholder.svg?height=36&width=36" alt={userData?.name || "Restaurant"} />
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
              <h1 className="text-xl font-semibold">
                {navItems.find((item) => item.href === pathname)?.title || "Restaurant Dashboard"}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {notifications > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs text-white">
                    {notifications}
                  </span>
                )}
              </Button>

              <div className="hidden md:flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" alt={userData?.name || "Restaurant"} />
                  <AvatarFallback>{userData?.name?.charAt(0) || "R"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{userData?.name}</p>
                  <p className="text-xs text-muted-foreground">Restaurant Manager</p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-6">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
