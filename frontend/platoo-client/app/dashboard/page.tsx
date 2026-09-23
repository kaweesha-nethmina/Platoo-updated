"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
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

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Role is resolved from the non-secret identity keys written at login.
    // The JWT itself only lives in an httpOnly cookie (V-08).
    const adminId = typeof window !== "undefined" ? localStorage.getItem("adminId") : null
    const ownerId = typeof window !== "undefined" ? localStorage.getItem("restaurantOwnerId") : null
    const deliveryId = typeof window !== "undefined" ? localStorage.getItem("deliveryManId") : null
    const uid = typeof window !== "undefined" ? localStorage.getItem("userId") : null

    if (!adminId && !ownerId && !deliveryId && !uid) {
      router.push("/login")
      return
    }

    if (adminId) {
      setUserRole(UserRole.ADMIN)
      setUserId(adminId)
    } else if (ownerId) {
      setUserRole(UserRole.RESTAURANT_OWNER)
      setUserId(ownerId)
    } else if (deliveryId) {
      setUserRole(UserRole.DELIVERY_MAN)
      setUserId(deliveryId)
    } else {
      setUserRole(UserRole.USER)
      setUserId(uid)
    }

    setIsLoading(false)
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

