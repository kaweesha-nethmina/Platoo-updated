"use client"
import { useState, useEffect, useRef } from "react"
import type React from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ShoppingCart,
  User,
  Clock,
  LogOut,
  Edit,
  PencilIcon,
  HomeIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  MapPinIcon,
  Search,
  Loader2,
} from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useCart } from "@/hooks/useCart"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Declare leaflet types
declare global {
  interface Window {
    L: any
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<{
    name: string
    email: string
    role: string
    phone?: string
    address?: string
    restaurantName?: string
    vehicleNumber?: string
    latitude?: number
    longitude?: number
  } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    email: string
    role: string
    phone?: string
    address?: string
    restaurantName?: string
    vehicleNumber?: string
    latitude?: number
    longitude?: number
    location?: { lat: number; lng: number }
  }>({
    name: "",
    email: "",
    role: "",
  })
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [formErrors, setFormErrors] = useState({
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  })
  const [activeTab, setActiveTab] = useState("personal")
  const [isLoading, setIsLoading] = useState(true)
  const { cartItems } = useCart()
  const cartCount = cartItems.length // Get the count of items in the cart

  // Map related states
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [marker, setMarker] = useState<any>(null)
  const [searchValue, setSearchValue] = useState("")
  const [locationSelected, setLocationSelected] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isMapLoading, setIsMapLoading] = useState(false)
  const [manualCoordinates, setManualCoordinates] = useState({ lat: "", lng: "" })

  useEffect(() => {
    const token = localStorage.getItem("jwtToken")

    if (!token) {
      router.push("/login") // Redirect to login if no token is found
      return
    }

    const userId = localStorage.getItem("userId")

    if (userId) {
      fetchUserData(token, userId) // Fetch user data if userId is available
    } else {
      router.push("/login") // Redirect to login if userId is missing
    }
  }, [router])

  // Initialize Leaflet Map
  useEffect(() => {
    if (activeTab === "addresses" && typeof window !== "undefined" && !map && mapRef.current) {
      setIsMapLoading(true)
      // Load Leaflet CSS
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link")
        link.id = "leaflet-css"
        link.rel = "stylesheet"
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        link.crossOrigin = ""
        document.head.appendChild(link)
      }

      // Load Leaflet JS
      if (!window.L) {
        const script = document.createElement("script")
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        script.crossOrigin = ""
        script.onload = () => {
          initializeMap()
          setIsMapLoading(false)
        }
        script.onerror = () => {
          setMapError("Failed to load map. Please check your internet connection and try again.")
          setIsMapLoading(false)
        }
        document.head.appendChild(script)
      } else {
        initializeMap()
        setIsMapLoading(false)
      }
    }
  }, [activeTab, map, mapRef.current])

  // Initialize map with user's location or default location
  const initializeMap = () => {
    if (!mapRef.current || !window.L) return

    try {
      const defaultLocation = [20.5937, 78.9629] // Default to center of India
      const userLocation = user?.latitude && user?.longitude ? [user.latitude, user.longitude] : defaultLocation

      const mapInstance = window.L.map(mapRef.current).setView(userLocation, 13)

      // Add OpenStreetMap tile layer
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstance)

      // Create marker at user's location if it exists
      if (user?.latitude && user?.longitude) {
        const markerInstance = window.L.marker([user.latitude, user.longitude], {
          draggable: true,
        }).addTo(mapInstance)

        // Add event listener for marker drag end
        markerInstance.on("dragend", (event: any) => {
          const position = event.target.getLatLng()
          updateLocationData(position.lat, position.lng)
          getAddressFromCoordinates(position.lat, position.lng)
        })

        setMarker(markerInstance)
        setLocationSelected(true)

        // Set manual coordinates
        setManualCoordinates({
          lat: user.latitude.toString(),
          lng: user.longitude.toString(),
        })
      }

      // Add click event listener to map for placing marker
      mapInstance.on("click", (e: any) => {
        const { lat, lng } = e.latlng
        console.log("Map clicked at:", lat, lng) // Debug log

        // Update or create marker
        if (marker) {
          marker.setLatLng([lat, lng])
        } else {
          const newMarker = window.L.marker([lat, lng], {
            draggable: true,
          }).addTo(mapInstance)

          // Add event listener for marker drag end
          newMarker.on("dragend", (event: any) => {
            const position = event.target.getLatLng()
            updateLocationData(position.lat, position.lng)
            getAddressFromCoordinates(position.lat, position.lng)
          })

          setMarker(newMarker)
        }

        // Update form data with clicked location
        updateLocationData(lat, lng)
        getAddressFromCoordinates(lat, lng)
        setLocationSelected(true)

        // Update manual coordinates
        setManualCoordinates({
          lat: lat.toString(),
          lng: lng.toString(),
        })
      })

      setMap(mapInstance)
      setMapError(null)
    } catch (error) {
      console.error("Error initializing map:", error)
      setMapError("Failed to initialize map. Please try again later.")
    }
  }

  // Update location data in form
  const updateLocationData = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      location: { lat, lng }, // Update the location field
    }));
  }

  // Get address from coordinates using Nominatim API
  const getAddressFromCoordinates = async (lat: number, lng: number) => {
    try {
      setIsSearching(true)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "ProfilePage/1.0",
          },
          signal: controller.signal,
        },
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data && data.display_name) {
        setFormData((prev) => ({
          ...prev,
          address: data.display_name,
        }))
        setSearchValue(data.display_name)
      } else {
        // If no address found, use coordinates as address
        const coordsAddress = `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`
        setFormData((prev) => ({
          ...prev,
          address: coordsAddress,
        }))
        setSearchValue(coordsAddress)
      }
    } catch (error) {
      console.error("Error fetching address:", error)
      // Use coordinates as address when API fails
      const coordsAddress = `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`
      setFormData((prev) => ({
        ...prev,
        address: coordsAddress,
      }))
      setSearchValue(coordsAddress)
    } finally {
      setIsSearching(false)
    }
  }

  // Search for location using Nominatim API
  const searchLocation = async (query: string) => {
    if (!query.trim()) return

    setIsSearching(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "ProfilePage/1.0",
          },
          signal: controller.signal,
        },
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("Search results:", data) // Debug log

      setSearchResults(data)

      // If search button was clicked and we have results, select the first one
      if (data.length > 0 && !showSearchResults) {
        handleSelectSearchResult(data[0])
      } else if (data.length > 0) {
        setShowSearchResults(true)
      } else {
        setMapError("No locations found. Try a different search term.")
        setTimeout(() => setMapError(null), 3000)
      }
    } catch (error) {
      console.error("Error searching location:", error)
      setMapError("Search failed. Please try again or enter coordinates manually.")
    } finally {
      setIsSearching(false)
    }
  }

  // Handle search result selection
  const handleSelectSearchResult = (result: any) => {
    if (!map) return

    const lat = Number.parseFloat(result.lat)
    const lng = Number.parseFloat(result.lon)

    console.log("Selected location:", lat, lng) // Debug log

    // Center map on selected location
    map.setView([lat, lng], 16)

    // Update or create marker
    if (marker) {
      marker.setLatLng([lat, lng])
    } else {
      const newMarker = window.L.marker([lat, lng], {
        draggable: true,
      }).addTo(map)

      // Add event listener for marker drag end
      newMarker.on("dragend", (event: any) => {
        const position = event.target.getLatLng()
        updateLocationData(position.lat, position.lng)
        getAddressFromCoordinates(position.lat, position.lng)
      })

      setMarker(newMarker)
    }

    // Update form data with selected location
    updateLocationData(lat, lng)
    setFormData((prev) => ({
      ...prev,
      address: result.display_name,
    }))
    setSearchValue(result.display_name)
    setLocationSelected(true)
    setShowSearchResults(false)

    // Update manual coordinates
    setManualCoordinates({
      lat: lat.toString(),
      lng: lng.toString(),
    })
  }

  // Handle manual coordinate input
  const handleManualCoordinateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualCoordinates({
      ...manualCoordinates,
      [e.target.name]: e.target.value,
    })
  }

  // Apply manual coordinates to the map
  const applyManualCoordinates = () => {
    const lat = Number.parseFloat(manualCoordinates.lat)
    const lng = Number.parseFloat(manualCoordinates.lng)

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setMapError("Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.")
      setTimeout(() => setMapError(null), 5000)
      return
    }

    if (!map) return

    // Center map on entered coordinates
    map.setView([lat, lng], 16)

    // Update or create marker
    if (marker) {
      marker.setLatLng([lat, lng])
    } else {
      const newMarker = window.L.marker([lat, lng], {
        draggable: true,
      }).addTo(map)

      // Add event listener for marker drag end
      newMarker.on("dragend", (event: any) => {
        const position = event.target.getLatLng()
        updateLocationData(position.lat, position.lng)
        getAddressFromCoordinates(position.lat, position.lng)
      })

      setMarker(newMarker)
    }

    // Update form data with entered coordinates
    updateLocationData(lat, lng)
    getAddressFromCoordinates(lat, lng)
    setLocationSelected(true)
  }

  const fetchUserData = async (token: string, userId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`http://localhost:4000/api/auth/user/${userId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text() // Capture raw HTML response
        console.error("Error:", errorText) // Log the error to inspect
        throw new Error("Failed to fetch user data")
      }

      const data = await response.json()

      setUser(data)
      setFormData({
        name: data.name,
        email: data.email,
        role: data.role,
        phone: data.phone,
        address: data.address,
        restaurantName: data.restaurantName,
        vehicleNumber: data.vehicleNumber,
        latitude: data.latitude,
        longitude: data.longitude,
      })
      localStorage.setItem("user", JSON.stringify(data)) // Store user data in localStorage
    } catch (error) {
      console.error("Error fetching user data:", error)
      router.push("/login") // Redirect to login if an error occurs
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = () => {
    localStorage.removeItem("jwtToken") // Remove token
    localStorage.removeItem("user") // Remove user data
    localStorage.removeItem("userId") // Remove userId
    setUser(null) // Reset user state
    router.push("/login") // Redirect to login page
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setFormErrors({ ...formErrors, [e.target.name]: "" }) // Clear errors on input change
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value)
    if (e.target.value.length > 2) {
      searchLocation(e.target.value)
    } else {
      setShowSearchResults(false)
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value })
    setFormErrors({ ...formErrors, [e.target.name]: "" }) // Clear errors on input change
  }

  // Frontend validation before submitting, only validates fields of the active tab
  const validateForm = () => {
    const errors = { email: "", phone: "", password: "", confirmPassword: "" }
    let isValid = true

    if (activeTab === "personal") {
      // Email validation: should end with @gmail.com
      if (!formData.email) {
        errors.email = "Email is required"
        isValid = false
      } else if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(formData.email)) {
        errors.email = "Enter valid gmail address"
        isValid = false
      }

      // Phone validation: should be exactly 10 digits
      if (!formData.phone) {
        errors.phone = "Phone number is required"
        isValid = false
      } else if (!/^\d{10}$/.test(formData.phone)) {
        errors.phone = "Phone number should be 10 digits"
        isValid = false
      }
    }

    if (activeTab === "password") {
      // Password validation: should be at least 8 characters long
      if (!passwordData.newPassword) {
        errors.password = "New password is required"
        isValid = false
      } else if (passwordData.newPassword.length < 8) {
        errors.password = "Password should be at least 8 characters"
        isValid = false
      }

      // Confirm password validation: should match the new password
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match"
        isValid = false
      }
    }

    if (activeTab === "addresses") {
      // No specific validation for address yet, but you can add it as needed
    }

    setFormErrors(errors) // Set error messages for the form
    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return // Prevent submitting if validation fails
    }

    const userId = localStorage.getItem("userId") // Get userId from localStorage

    if (!userId) {
      console.error("User ID not found")
      return
    }

    try {
      const response = await fetch(`http://localhost:4000/api/auth/update/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorText = await response.text() // Capture raw HTML response
        console.error("Error:", errorText) // Log the error to inspect
        throw new Error("Failed to update user data")
      }

      const data = await response.json()

      // Update localStorage with new data
      localStorage.setItem("user", JSON.stringify(formData))
      setUser(formData) // Update user state with the new data
      setIsEditing(false) // Exit the editing mode
    } catch (error) {
      console.error("Error updating profile:", error)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate password and confirm password
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setFormErrors({
        ...formErrors,
        confirmPassword: "Passwords do not match",
      })
      return
    }

    if (passwordData.newPassword.length < 8) {
      setFormErrors({
        ...formErrors,
        password: "Password should be at least 8 characters",
      })
      return
    }

    const userId = localStorage.getItem("userId") // Get userId from localStorage

    if (!userId) {
      console.error("User ID not found")
      return
    }

    try {
      const response = await fetch(`http://localhost:4000/api/auth/update/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
        },
        body: JSON.stringify({ newPassword: passwordData.newPassword }), // Send newPassword to update
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Error:", errorText)
        throw new Error("Failed to update password")
      }

      const data = await response.json()
      setPasswordData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      alert("Password updated successfully")
    } catch (error) {
      console.error("Error updating password:", error)
    }
  }

  // Handle address save
  const handleSaveAddress = async () => {
    // Ensure that the user has selected a location on the map
    if (!formData.address || !formData.latitude || !formData.longitude) {
      alert("Please select a location on the map");
      return;
    }
  
    const userId = localStorage.getItem("userId");
    if (!userId) {
      console.error("User ID not found");
      return;
    }
  
    try {
      const response = await fetch(`http://localhost:4000/api/auth/update/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
        },
        body: JSON.stringify({
          address: formData.address,
          location: { lat: formData.latitude, lng: formData.longitude }, // Save latitude and longitude as an object
        }),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error:", errorText);
        throw new Error("Failed to update address");
      }
  
      const data = await response.json();
  
      // Update user state and localStorage with the new `location` field
      setUser((prev) =>
        prev
          ? { ...prev, address: formData.address, location: { lat: formData.latitude, lng: formData.longitude } }
          : null,
      );
  
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...storedUser,
          address: formData.address,
          location: { lat: formData.latitude, lng: formData.longitude }, // Save location as an object
        }),
      );
  
      setIsEditing(false);
      alert("Address updated successfully");
    } catch (error) {
      console.error("Error updating address:", error);
    }
  };

  const [showClearButton, setShowClearButton] = useState(false)

  const handleSearchInputChangeAddresses = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    setShowClearButton(value.length > 0) // Show clear button if there is text

    if (value.length > 2) {
      searchLocation(value)
    } else {
      setShowSearchResults(false)
    }
  }

  const clearSearchValue = () => {
    setSearchValue("")
    setShowSearchResults(false)
    setShowClearButton(false)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500">Loading user profile...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500">
          User not found. Please{" "}
          <Link href="/login" className="text-red-500 hover:underline">
            login
          </Link>{" "}
          again.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header cartCount={cartCount} />

      <main className="max-w-[1400px] mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Profile Sidebar */}
          <div className="w-full md:w-1/4">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center mb-6">
                  <Avatar className="h-24 w-24 mb-4">
                    <AvatarImage src="/avatar.png?height=96&width=96" alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-bold">{user.name}</h2>
                  <p className="text-gray-500">{user.email}</p>
                </div>

                <nav className="space-y-1">
                  <Link
                    href="/profile"
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md bg-red-50 text-red-500"
                  >
                    <User className="mr-3 h-5 w-5" />
                    Personal Information
                  </Link>

                  <Link
                    href="/orders/history"
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Clock className="mr-3 h-5 w-5" />
                    Order History
                  </Link>

                  <Link
                    href="/cart"
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <ShoppingCart className="mr-3 h-5 w-5" />
                    My Cart
                  </Link>

                  <Separator className="my-2" />

                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center px-3 py-2 text-sm font-medium rounded-md text-red-500 hover:bg-red-50"
                  >
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                  </button>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="w-full md:w-3/4">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="personal" onClick={() => setActiveTab("personal")}>
                  Personal Info
                </TabsTrigger>
                <TabsTrigger value="addresses" onClick={() => setActiveTab("addresses")}>
                  Addresses
                </TabsTrigger>
                <TabsTrigger value="password" onClick={() => setActiveTab("password")}>
                  Password
                </TabsTrigger>
              </TabsList>

              {/* Personal Information Tab */}
              <TabsContent value="personal">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Personal Information</CardTitle>
                      <CardDescription>Manage your personal details</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                      {isEditing ? (
                        "Cancel"
                      ) : (
                        <>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </>
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="name" className="text-sm font-medium">
                            Full Name
                          </label>
                          <Input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            disabled={!isEditing}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="email" className="text-sm font-medium">
                            Email Address
                          </label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={!isEditing}
                            required
                          />
                          {formErrors.email && <p className="text-red-500 text-sm">{formErrors.email}</p>}
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="phone" className="text-sm font-medium">
                            Phone Number
                          </label>
                          <Input
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            disabled={!isEditing}
                          />
                          {formErrors.phone && <p className="text-red-500 text-sm">{formErrors.phone}</p>}
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="address" className="text-sm font-medium">
                            Address
                          </label>
                          <Input
                            id="address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            disabled={!isEditing}
                          />
                        </div>
                      </div>
                      {isEditing && (
                        <div className="flex justify-end">
                          <Button type="submit" className="bg-red-500 hover:bg-red-600">
                            Save Changes
                          </Button>
                        </div>
                      )}
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Password Tab */}
              <TabsContent value="password">
                <Card>
                  <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Update your password to keep your account secure</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="oldPassword" className="text-sm font-medium">
                          Old Password
                        </label>
                        <Input
                          id="oldPassword"
                          name="oldPassword"
                          type="password"
                          value={passwordData.oldPassword}
                          onChange={handlePasswordChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="newPassword" className="text-sm font-medium">
                          New Password
                        </label>
                        <Input
                          id="newPassword"
                          name="newPassword"
                          type="password"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          required
                        />
                        {formErrors.password && <p className="text-red-500 text-sm">{formErrors.password}</p>}
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="text-sm font-medium">
                          Confirm New Password
                        </label>
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          required
                        />
                        {formErrors.confirmPassword && (
                          <p className="text-red-500 text-sm">{formErrors.confirmPassword}</p>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit" className="bg-red-500 hover:bg-red-600">
                          Change Password
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Addresses Tab */}
              <TabsContent value="addresses">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-medium">
                      <MapPinIcon className="h-4 w-4 text-red-500" /> Delivery Addresses
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 text-sm">
                      {user?.address ? (
                        <>
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          Your current address: <span className="font-medium">{user.address}</span>
                        </>
                      ) : (
                        <>
                          <AlertCircleIcon className="h-4 w-4 text-yellow-500" />
                          You haven't added any delivery addresses yet. Add one to make ordering faster.
                        </>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="py-6">
                    {/* Error Alert */}
                    {mapError && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircleIcon className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{mapError}</AlertDescription>
                      </Alert>
                    )}

                    {/* Location Search and Map */}
                    <div className="space-y-4">
                      <div className="flex flex-col space-y-2">
                        <label htmlFor="location-search" className="text-sm font-medium">
                          Search for a location or click on the map
                        </label>
                        <div className="relative">
                          <Input
                            id="location-search"
                            placeholder="Search for an address..."
                            value={searchValue}
                            onChange={handleSearchInputChange}
                            className="w-full pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              // When search button is clicked, we want to auto-select the first result
                              setShowSearchResults(false)
                              searchLocation(searchValue)
                            }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            disabled={isSearching || !searchValue.trim()}
                          >
                            {isSearching ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            <span className="sr-only">Search</span>
                          </button>

                          {/* Search Results Dropdown */}
                          {showSearchResults && searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto">
                              {searchResults.map((result, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                                  onClick={() => handleSelectSearchResult(result)}
                                >
                                  {result.display_name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Manual Coordinates Input */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                        <div className="space-y-2">
                          <label htmlFor="lat" className="text-sm font-medium">
                            Latitude
                          </label>
                          <Input
                            id="lat"
                            name="lat"
                            value={manualCoordinates.lat}
                            onChange={handleManualCoordinateChange}
                            placeholder="e.g. 20.5937"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="lng" className="text-sm font-medium">
                            Longitude
                          </label>
                          <Input
                            id="lng"
                            name="lng"
                            value={manualCoordinates.lng}
                            onChange={handleManualCoordinateChange}
                            placeholder="e.g. 78.9629"
                          />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                          <Button
                            type="button"
                            onClick={applyManualCoordinates}
                            className="w-full bg-red-500 hover:bg-red-600"
                            disabled={!manualCoordinates.lat || !manualCoordinates.lng}
                          >
                            Apply Coordinates
                          </Button>
                        </div>
                      </div>

                      {/* Map Container */}
                      <div className="relative">
                        {isMapLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10 rounded-md">
                            <div className="flex flex-col items-center">
                              <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
                              <p className="mt-2 text-sm text-gray-600">Loading map...</p>
                            </div>
                          </div>
                        )}
                        <div
                          ref={mapRef}
                          className="w-full h-[300px] rounded-md border border-gray-200 bg-gray-50"
                        ></div>
                      </div>

                      {/* Selected Location Display */}
                      {locationSelected && (
                        <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                          <h3 className="text-sm font-medium mb-2">Selected Location</h3>
                          <p className="text-sm text-gray-700">{formData.address}</p>
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLocationSelected(false)
                                if (marker && map) {
                                  marker.remove()
                                  setMarker(null)
                                }
                                setFormData((prev) => ({
                                  ...prev,
                                  address: "",
                                  latitude: undefined,
                                  longitude: undefined,
                                }))
                                setSearchValue("")
                                setManualCoordinates({ lat: "", lng: "" })
                              }}
                            >
                              Clear
                            </Button>
                            <Button size="sm" className="bg-red-500 hover:bg-red-600" onClick={handleSaveAddress}>
                              Save Address
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Current Address Display */}
                    {user?.address && (
                      <div className="mt-6">
                        <h3 className="text-sm font-medium mb-2">Current Delivery Address</h3>
                        <div className="w-full max-w-md p-4 bg-white shadow-sm rounded-lg border border-gray-200 transition-shadow hover:shadow-md">
                          <div className="flex justify-between items-center">
                            <p className="text-sm flex items-center gap-2">
                              <HomeIcon className="h-4 w-4 text-blue-500" />
                              {user.address}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditing(true)}
                              className="flex items-center gap-1 text-red-500 border-red-500 hover:bg-red-50 transition-colors"
                            >
                              <PencilIcon className="h-3 w-3" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
