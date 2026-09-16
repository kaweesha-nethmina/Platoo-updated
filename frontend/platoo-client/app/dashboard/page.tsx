"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { jwtDecode } from "jwt-decode"
import UserDashboard from "@/components/dashboards/user-dashboard"
import AdminDashboard from "@/components/dashboards/admin-dashboard"
import DeliveryDashboard from "@/components/dashboards/delivery-dashboard"
import RestaurantDashboard from "@/components/dashboards/restaurant-dashboard"

// Define user roles to match your backend
export enum UserRole {
  ADMIN = "admin",
  RESTAURANT_OWNER = "restaurant_owner",
  USER = "user",
  DELIVERY_MAN = "delivery_man",
}

interface JwtPayload {
  id: string
  role: UserRole
  iat: number
  exp: number
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/login")
      return
    }

    try {
      // Decode the JWT token to get user role
      const decoded = jwtDecode<JwtPayload>(token)
      setUserRole(decoded.role)
      setUserId(decoded.id)
    } catch (error) {
      console.error("Invalid token:", error)
      localStorage.removeItem("token")
      router.push("/login")
    } finally {
      setIsLoading(false)
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        <span className="ml-2 text-lg">Loading dashboard...</span>
      </div>
    )
  }

  // Render the appropriate dashboard based on user role
  return (
    <>
      {userRole === UserRole.USER && <UserDashboard userId={userId!} />}
      {userRole === UserRole.ADMIN && <AdminDashboard />}
      {userRole === UserRole.DELIVERY_MAN && <DeliveryDashboard userId={userId!} />}
      {userRole === UserRole.RESTAURANT_OWNER && <RestaurantDashboard userId={userId!} />}
    </>
  )
}

