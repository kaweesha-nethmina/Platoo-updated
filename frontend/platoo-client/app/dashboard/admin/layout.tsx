"use client"

import React, { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
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
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

// Material UI Icons
import DashboardIcon from "@mui/icons-material/Dashboard"
import PeopleIcon from "@mui/icons-material/People"
import RestaurantIcon from "@mui/icons-material/Restaurant"
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart"
import LocalShippingIcon from "@mui/icons-material/LocalShipping"
import AssessmentIcon from "@mui/icons-material/Assessment"
import LogoutIcon from "@mui/icons-material/Logout"
import SearchIcon from "@mui/icons-material/Search"
import AccountCircleIcon from "@mui/icons-material/AccountCircle"

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [userData, setUserData] = useState<{
    id: string
    name: string
    email: string
    role: string
  } | null>(null)
  const [ordersCount, setOrdersCount] = useState<number | null>(null)

  useEffect(() => {
    // V-08: the JWT only lives in an httpOnly cookie; the admin dashboard is
    // gated by the non-secret identity key written at login.
    const adminId = localStorage.getItem("adminId")
    if (!adminId) {
      router.push("/login")
      return
    }

    // Fetch real user data from backend using the admin id
    fetch(`/api/proxy/user/auth/user/${adminId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch user data")
        return res.json()
      })
      .then((data) => {
        setUserData({
          id: data.id ?? data._id,
          name: data.name,
          email: data.email,
          role: data.role,
        })
      })
      .catch((err) => {
        console.warn(err)
        setUserData({
          id: adminId,
          name: "Admin User",
          email: "admin@example.com",
          role: "admin",
        })
      })
      .finally(() => setIsLoading(false))
  }, [router])

  // Fetch orders count
  useEffect(() => {
    fetch("/api/proxy/order/orders")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch orders")
        return res.json()
      })
      .then((orders) => {
        setOrdersCount(Array.isArray(orders) ? orders.length : 0)
      })
      .catch((err) => {
        console.warn(err)
        setOrdersCount(0)
      })
  }, [])

  const handleSignOut = async () => {
    ["adminId", "restaurantOwnerId", "deliveryManId", "userId", "user"].forEach((k) =>
      localStorage.removeItem(k)
    )
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch (err) {
      console.warn(err)
    }
    router.push("/login")
  }

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard/admin",
      icon: <DashboardIcon fontSize="small" />,
      badge: null,
    },
    {
      title: "Users",
      href: "/dashboard/admin/users",
      icon: <PeopleIcon fontSize="small" />,
      badge: null,
    },
    {
      title: "Restaurants",
      href: "/dashboard/admin/restaurants",
      icon: <RestaurantIcon fontSize="small" />,
      badge: null,
    },
    {
      title: "Orders",
      href: "/dashboard/admin/orders",
      icon: <ShoppingCartIcon fontSize="small" />,
      badge: ordersCount !== null ? { count: ordersCount, variant: "default" } : null,
    },
    {
      title: "Delivery",
      href: "/dashboard/admin/delivery",
      icon: <LocalShippingIcon fontSize="small" />,
      badge: null,
    },
    {
      title: "Reports",
      href: "/dashboard/admin/reports",
      icon: <AssessmentIcon fontSize="small" />,
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
      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <Sidebar>
          <SidebarHeader className="flex h-16 items-center border-b px-6">
            <Link href="/dashboard/admin" className="flex items-center gap-2 font-semibold">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500 text-white">
                <span className="text-lg font-bold">P</span>
              </div>
              <span className="text-lg font-bold">Platoo Admin</span>
            </Link>
          </SidebarHeader>

          <SidebarContent>
            <div className="px-4 py-4">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-9 bg-muted/50" />
              </div>
            </div>

            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href} className="flex justify-between w-full">
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <span>{item.title}</span>
                      </div>
                      {item.badge && (
                        <Badge className="ml-auto bg-red-500 text-white">
                          {item.badge.count}
                        </Badge>
                      )}
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
                <AccountCircleIcon fontSize="large" className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{userData?.name}</p>
                  <p className="text-xs text-muted-foreground">{userData?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{userData?.role}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogoutIcon fontSize="small" />
                <span className="sr-only">Sign out</span>
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">
                {navItems.find((item) => item.href === pathname)?.title || "Admin Dashboard"}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <AccountCircleIcon fontSize="large" className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{userData?.name}</p>
                  <p className="text-xs text-muted-foreground">{userData?.email}</p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="w-full p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
