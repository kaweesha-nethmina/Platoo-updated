"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
import {
  Home,
  ShoppingBag,
  Heart,
  User,
  Settings,
  LogOut,
  LayoutDashboard,
  Users,
  Store,
  Truck,
  BarChart3,
  Utensils,
  BarChart2,
  DollarSign,
} from "lucide-react"

interface NavItem {
  title: string
  href: string
  icon: string
}

interface DashboardLayoutProps {
  children: React.ReactNode
  navItems: NavItem[]
}

export function DashboardLayout({ children, navItems }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = () => {
    setIsSigningOut(true)
    // In a real app, perform sign out logic here
    localStorage.removeItem("token")
    window.location.href = "/login"
  }

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "home":
        return <Home className="h-4 w-4" />
      case "shopping-bag":
        return <ShoppingBag className="h-4 w-4" />
      case "heart":
        return <Heart className="h-4 w-4" />
      case "user":
        return <User className="h-4 w-4" />
      case "settings":
        return <Settings className="h-4 w-4" />
      case "layout-dashboard":
        return <LayoutDashboard className="h-4 w-4" />
      case "users":
        return <Users className="h-4 w-4" />
      case "store":
        return <Store className="h-4 w-4" />
      case "truck":
        return <Truck className="h-4 w-4" />
      case "bar-chart-3":
        return <BarChart3 className="h-4 w-4" />
      case "utensils":
        return <Utensils className="h-4 w-4" />
      case "bar-chart-2":
        return <BarChart2 className="h-4 w-4" />
      case "dollar-sign":
        return <DollarSign className="h-4 w-4" />
      default:
        return <Home className="h-4 w-4" />
    }
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader className="flex h-14 items-center border-b px-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Store className="h-6 w-6 text-orange-600" />
              <span className="text-lg font-bold">Platoo</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      {getIconComponent(item.icon)}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarSeparator />
          <SidebarFooter className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="text-sm">
                  <div className="font-medium">User</div>
                  <div className="text-xs text-muted-foreground">user@example.com</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleSignOut} disabled={isSigningOut}>
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1">
          <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background px-4 lg:px-6">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}

