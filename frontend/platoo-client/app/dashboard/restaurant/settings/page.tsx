"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface OwnerInfo {
  name: string
  email: string
  phone: string
  address: string
  restaurantName: string
}

const RESTAURANT_SCHEMA = {
  name: "",
  image: "",
  rating: 0,
  deliveryTime: "",
  deliveryFee: "",
  minOrder: "",
  distance: "",
  cuisines: [],
  priceLevel: 1,
  is_active: true,
  location: {
    type: "Point",
    coordinates: [0, 0],
    tag: "",
  },
  open_time: "",
  closed_time: "",
  owner_id: "",
}

// --- Leaflet types for TS
declare global {
  interface Window {
    L: any
    LControlGeocoder: any
  }
}

export default function RestaurantSettings() {
  const router = useRouter()

  // Owner state and logic
  const [owner, setOwner] = useState<OwnerInfo>({
    name: "",
    email: "",
    phone: "",
    address: "",
    restaurantName: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [password, setPassword] = useState("")
  const [ownerId, setOwnerId] = useState<string | null>(null)

  useEffect(() => {
    const storedId = localStorage.getItem("restaurantOwnerId")
    if (!storedId) {
      console.error("Owner ID not found in localStorage")
      return
    }
    setOwnerId(storedId)
    const fetchOwner = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`http://localhost:4000/api/auth/restaurant-owner/${storedId}`)
        if (!res.ok) throw new Error("Failed to fetch owner data")
        const data = await res.json()
        setOwner({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          restaurantName: data.restaurantName || "",
        })
        localStorage.setItem("owner", JSON.stringify(data))
      } catch (error) {
        console.error("Error fetching owner data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchOwner()
  }, [])

  const handleSaveOwner = async () => {
    if (!ownerId) {
      alert("Owner ID not found in localStorage.")
      return
    }
    if (!password) {
      alert("Please enter your password to save changes.")
      return
    }
    const token = localStorage.getItem("jwtToken")
    if (!token) {
      alert("You are not authenticated.")
      return
    }
    try {
      const response = await fetch(`http://localhost:4000/api/auth/update/${ownerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...owner, password }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to update profile")
      }
      alert("Owner info updated successfully!")
      setIsEditing(false)
      setPassword("")
      localStorage.setItem("owner", JSON.stringify(owner))
      // Clear local storage and redirect to login after update
      localStorage.removeItem("restaurantOwnerId")
      localStorage.removeItem("owner")
      localStorage.removeItem("restaurantId")
      localStorage.removeItem("jwtToken")
      router.push("/login")
    } catch (error) {
      console.error("Error updating owner info:", error)
      alert("Error updating owner info.")
    }
  }

  // Delete owner handler
  const handleDeleteOwner = async () => {
    if (!ownerId) {
      alert("Owner ID not found in localStorage.")
      return
    }
    const token = localStorage.getItem("jwtToken")
    if (!token) {
      alert("You are not authenticated.")
      return
    }
    const confirmDelete = window.confirm(
      "Are you sure you want to permanently delete your account? This action cannot be undone.",
    )
    if (!confirmDelete) return
    try {
      const response = await fetch(`http://localhost:4000/api/auth/delete/${ownerId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete account")
      }
      // Clear local storage and redirect
      localStorage.removeItem("restaurantOwnerId")
      localStorage.removeItem("owner")
      localStorage.removeItem("restaurantId")
      localStorage.removeItem("jwtToken")
      window.location.href = "/login"
    } catch (error) {
      console.error("Error deleting owner account:", error)
      alert("Error deleting account. Please try again.")
    }
  }

  // Restaurant state and logic
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [filteredRestaurants, setFilteredRestaurants] = useState<any[]>([])
  const [restaurantForm, setRestaurantForm] = useState<any>(RESTAURANT_SCHEMA)
  const [isAddRestaurantOpen, setIsAddRestaurantOpen] = useState(false)
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null)
  const [isRestaurantLoading, setIsRestaurantLoading] = useState(true)

  // Add New Restaurant dialog state
  const [addRestaurantForm, setAddRestaurantForm] = useState<any>(RESTAURANT_SCHEMA)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isAddMapLoading, setIsAddMapLoading] = useState(false)
  const [addMapError, setAddMapError] = useState<string | null>(null)
  const addMapRef = useRef<HTMLDivElement>(null)
  const [addMap, setAddMap] = useState<any>(null)
  const [addMarker, setAddMarker] = useState<any>(null)

  // --- GEOLOCATION STATES
  const [isMapLoading, setIsMapLoading] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [marker, setMarker] = useState<any>(null)

  // --- EDIT MODE STATE FOR RESTAURANT FORM ---
  const [isRestaurantEditing, setIsRestaurantEditing] = useState(false)

  useEffect(() => {
    fetchRestaurants()
  }, [])

  useEffect(() => {
    if (ownerId) {
      setFilteredRestaurants(restaurants.filter((r) => r.owner_id === ownerId))
    }
  }, [restaurants, ownerId])

  // Automatically open edit dialog for first restaurant if not already open
  useEffect(() => {
    if (filteredRestaurants.length > 0 && !isAddRestaurantOpen && !selectedRestaurant) {
      const firstRestaurant = filteredRestaurants[0]
      setSelectedRestaurant(firstRestaurant)
      setRestaurantForm({ ...firstRestaurant })
    }
  }, [filteredRestaurants])

  const fetchRestaurants = async () => {
    setIsRestaurantLoading(true)
    try {
      const response = await fetch("http://localhost:3001/api/restaurants")
      const data = await response.json()
      setRestaurants(data)
    } catch (error) {
      console.error("Error fetching restaurants:", error)
    }
    setIsRestaurantLoading(false)
  }

  const handleAddOrUpdateRestaurant = async () => {
    try {
      const url = selectedRestaurant
        ? `http://localhost:3001/api/restaurants/${selectedRestaurant._id}`
        : "http://localhost:3001/api/restaurants"
      const method = selectedRestaurant ? "PUT" : "POST"
      const restaurantData = {
        ...restaurantForm,
        owner_id: ownerId,
      }
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restaurantData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to save restaurant")
      }
      alert(`Restaurant ${selectedRestaurant ? "updated" : "added"} successfully!`)
      fetchRestaurants()
      setIsAddRestaurantOpen(false)
      setSelectedRestaurant(null)
      setIsRestaurantEditing(false)
    } catch (error) {
      console.error("Error saving restaurant:", error)
      alert("Error saving restaurant. Please try again.")
    }
  }

  // --- Add New Restaurant Logic ---
  const handleAddRestaurantInput = (field: string, value: any) => {
    setAddRestaurantForm((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }
  const handleAddLocationInput = (field: string, value: any) => {
    setAddRestaurantForm((prev: any) => ({
      ...prev,
      location: {
        ...prev.location,
        [field]: value,
      },
    }))
  }
  const updateAddRestaurantLocation = (lat: number, lng: number) => {
    setAddRestaurantForm((prev: any) => ({
      ...prev,
      location: {
        ...prev.location,
        coordinates: [lng, lat], // [lng, lat] for GeoJSON
      },
    }))
  }
  // --- GEOLOCATION LOGIC FOR ADD DIALOG ---
  useEffect(() => {
    if (!isAddDialogOpen) return
    setIsAddMapLoading(true)
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
    // Load Geocoder CSS
    if (!document.getElementById("leaflet-geocoder-css")) {
      const link = document.createElement("link")
      link.id = "leaflet-geocoder-css"
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.css"
      document.head.appendChild(link)
    }
    // Load Leaflet JS
    const loadLeaflet = () =>
      new Promise<void>((resolve, reject) => {
        if (window.L) return resolve()
        const script = document.createElement("script")
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        script.crossOrigin = ""
        script.onload = () => resolve()
        script.onerror = () => reject()
        document.head.appendChild(script)
      })
    // Load Geocoder JS
    const loadGeocoder = () =>
      new Promise<void>((resolve, reject) => {
        if (window.L && window.L.Control && window.L.Control.Geocoder) return resolve()
        const script = document.createElement("script")
        script.src = "https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js"
        script.onload = () => resolve()
        script.onerror = () => reject()
        document.head.appendChild(script)
      })
    Promise.all([loadLeaflet(), loadGeocoder()])
      .then(() => {
        initializeAddMap()
        setIsAddMapLoading(false)
      })
      .catch(() => {
        setAddMapError("Failed to load map or geocoder. Please check your internet connection and try again.")
        setIsAddMapLoading(false)
      })
    // eslint-disable-next-line
  }, [isAddDialogOpen])

  const initializeAddMap = () => {
    if (!addMapRef.current || !window.L || !window.L.Control || !window.L.Control.Geocoder) return
    try {
      const defaultLocation = [20.5937, 78.9629] // India center
      const coords = addRestaurantForm.location?.coordinates
      const hasCoords = coords && coords[0] !== 0 && coords[1] !== 0
      const startLocation = hasCoords ? [coords[1], coords[0]] : defaultLocation
      // Remove any previous map instance
      if (addMapRef.current && addMapRef.current.innerHTML) {
        addMapRef.current.innerHTML = ""
      }
      const mapInstance = window.L.map(addMapRef.current).setView(startLocation, 5)
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstance)
      // Add geocoder search box
      const geocoder = window.L.Control.geocoder({
        defaultMarkGeocode: false,
        placeholder: "Search for city or address...",
      })
        .on("markgeocode", (e: any) => {
          const bbox = e.geocode.bbox
          const center = e.geocode.center
          mapInstance.fitBounds(bbox)
          // Remove old marker if exists
          if (addMarker) {
            mapInstance.removeLayer(addMarker)
          }
          // Place marker at result
          const newMarker = window.L.marker(center, { draggable: true }).addTo(mapInstance)
          setAddMarker(newMarker)
          updateAddRestaurantLocation(center.lat, center.lng)
          // Set tag/address
          setAddRestaurantForm((prev: any) => ({
            ...prev,
            location: {
              ...prev.location,
              tag: e.geocode.name,
            },
          }))
          // Drag marker to update location
          newMarker.on("dragend", (event: any) => {
            const position = event.target.getLatLng()
            updateAddRestaurantLocation(position.lat, position.lng)
          })
        })
        .addTo(mapInstance)
      // If editing, place marker
      if (hasCoords) {
        const markerInstance = window.L.marker([coords[1], coords[0]], {
          draggable: true,
        }).addTo(mapInstance)
        markerInstance.on("dragend", (event: any) => {
          const position = event.target.getLatLng()
          updateAddRestaurantLocation(position.lat, position.lng)
        })
        setAddMarker(markerInstance)
      }
      setAddMap(mapInstance)
      setAddMapError(null)
    } catch (error) {
      setAddMapError("Failed to initialize map. Please try again later.")
    }
  }

  const handleAddRestaurantSubmit = async (e: any) => {
    e.preventDefault()
    try {
      const restaurantData = {
        ...addRestaurantForm,
        owner_id: ownerId,
      }
      const response = await fetch("http://localhost:3001/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restaurantData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to add restaurant")
      }
      alert("Restaurant added successfully!")
      setIsAddDialogOpen(false)
      setAddRestaurantForm(RESTAURANT_SCHEMA)
      fetchRestaurants()
    } catch (error) {
      console.error("Error adding restaurant:", error)
      alert("Error adding restaurant. Please try again.")
    }
  }

  const handleDeleteRestaurant = async () => {
    if (!selectedRestaurant?._id) {
      alert("No restaurant selected to delete.")
      return
    }
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this restaurant? This action cannot be undone.",
    )
    if (!confirmDelete) return
    try {
      const response = await fetch(`http://localhost:3001/api/restaurants/${selectedRestaurant._id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete restaurant")
      }
      alert("Restaurant deleted successfully!")
      fetchRestaurants()
      setIsAddRestaurantOpen(false)
      setSelectedRestaurant(null)
      setIsRestaurantEditing(false)
    } catch (error) {
      console.error("Error deleting restaurant:", error)
      alert("Error deleting restaurant. Please try again.")
    }
  }

  const handleRestaurantInput = (field: string, value: any) => {
    setRestaurantForm((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleLocationInput = (field: string, value: any) => {
    setRestaurantForm((prev: any) => ({
      ...prev,
      location: {
        ...prev.location,
        [field]: value,
      },
    }))
  }

  // --- GEOLOCATION LOGIC WITH MAP SEARCH ---
  useEffect(() => {
    // Only load map if there is a selected restaurant (i.e., profile edit/view tab is active)
    if (!selectedRestaurant) return
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
    // Load Geocoder CSS
    if (!document.getElementById("leaflet-geocoder-css")) {
      const link = document.createElement("link")
      link.id = "leaflet-geocoder-css"
      link.rel = "stylesheet"
      link.href = "https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.css"
      document.head.appendChild(link)
    }
    // Load Leaflet JS
    const loadLeaflet = () =>
      new Promise<void>((resolve, reject) => {
        if (window.L) return resolve()
        const script = document.createElement("script")
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        script.crossOrigin = ""
        script.onload = () => resolve()
        script.onerror = () => reject()
        document.head.appendChild(script)
      })
    // Load Geocoder JS
    const loadGeocoder = () =>
      new Promise<void>((resolve, reject) => {
        if (window.L && window.L.Control && window.L.Control.Geocoder) return resolve()
        const script = document.createElement("script")
        script.src = "https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js"
        script.onload = () => resolve()
        script.onerror = () => reject()
        document.head.appendChild(script)
      })
    Promise.all([loadLeaflet(), loadGeocoder()])
      .then(() => {
        initializeMap()
        setIsMapLoading(false)
      })
      .catch(() => {
        setMapError("Failed to load map or geocoder. Please check your internet connection and try again.")
        setIsMapLoading(false)
      })
    // eslint-disable-next-line
  }, [selectedRestaurant, isRestaurantEditing])

  const initializeMap = () => {
    if (!mapRef.current || !window.L || !window.L.Control || !window.L.Control.Geocoder) return
    try {
      // --- FIX: Remove previous map instance if exists ---
      if (map) {
        map.remove()
        setMap(null)
      }
      // Remove any previous map instance from DOM (for safety)
      if (mapRef.current && mapRef.current.innerHTML) {
        mapRef.current.innerHTML = ""
      }
      const defaultLocation = [20.5937, 78.9629] // India center
      const coords = restaurantForm.location?.coordinates
      const hasCoords = coords && coords[0] !== 0 && coords[1] !== 0
      const startLocation = hasCoords ? [coords[1], coords[0]] : defaultLocation
      const mapInstance = window.L.map(mapRef.current).setView(startLocation, 5)
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstance)
      // Add geocoder search box
      const geocoder = window.L.Control.geocoder({
        defaultMarkGeocode: false,
        placeholder: "Search for city or address...",
      })
        .on("markgeocode", (e: any) => {
          const bbox = e.geocode.bbox
          const center = e.geocode.center
          mapInstance.fitBounds(bbox)
          // Remove old marker if exists
          if (marker) {
            mapInstance.removeLayer(marker)
          }
          // Place marker at result
          const newMarker = window.L.marker(center, { draggable: true }).addTo(mapInstance)
          setMarker(newMarker)
          updateRestaurantLocation(center.lat, center.lng)
          // Set tag/address
          setRestaurantForm((prev: any) => ({
            ...prev,
            location: {
              ...prev.location,
              tag: e.geocode.name,
            },
          }))
          // Drag marker to update location
          newMarker.on("dragend", (event: any) => {
            const position = event.target.getLatLng()
            updateRestaurantLocation(position.lat, position.lng)
          })
        })
        .addTo(mapInstance)
      // If editing, place marker
      if (hasCoords) {
        const markerInstance = window.L.marker([coords[1], coords[0]], {
          draggable: true,
        }).addTo(mapInstance)
        markerInstance.on("dragend", (event: any) => {
          const position = event.target.getLatLng()
          updateRestaurantLocation(position.lat, position.lng)
        })
        setMarker(markerInstance)
      }
      setMap(mapInstance)
      setMapError(null)
    } catch (error) {
      setMapError("Failed to initialize map. Please try again later.")
    }
  }

  // Update restaurantForm.location and tag
  const updateRestaurantLocation = (lat: number, lng: number) => {
    setRestaurantForm((prev: any) => ({
      ...prev,
      location: {
        ...prev.location,
        coordinates: [lng, lat], // [lng, lat] for GeoJSON
      },
    }))
  }

  // --- END GEOLOCATION LOGIC ---

  // --- UI LOGIC FOR ADD BUTTON ---
  const canAddRestaurant = filteredRestaurants.length === 0

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      {/* Add New Restaurant Button */}
      {canAddRestaurant && (
        <div className="mb-4">
          <Button
            onClick={() => {
              setIsAddDialogOpen(true)
              setAddRestaurantForm({ ...RESTAURANT_SCHEMA, owner_id: ownerId })
            }}
          >
            Add New Restaurant
          </Button>
        </div>
      )}
      {/* Add New Restaurant Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Restaurant</DialogTitle>
            <DialogDescription>Fill out the restaurant details below.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddRestaurantSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="add-restaurant-image">Restaurant Image</Label>
              <div className="flex flex-col gap-4 w-full">
                <Input
                  id="add-restaurant-image"
                  value={addRestaurantForm.image}
                  onChange={(e) => handleAddRestaurantInput("image", e.target.value)}
                  placeholder="Enter image URL"
                />
                {addRestaurantForm.image && (
                  <img
                    src={addRestaurantForm.image || "/placeholder.svg"}
                    alt="Restaurant Preview"
                    className="w-full h-60 object-cover rounded-md mt-2"
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-restaurant-name">Restaurant Name</Label>
              <Input
                id="add-restaurant-name"
                value={addRestaurantForm.name}
                onChange={(e) => handleAddRestaurantInput("name", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-restaurant-rating">Rating</Label>
                <Input
                  id="add-restaurant-rating"
                  type="number"
                  value={addRestaurantForm.rating}
                  onChange={(e) => handleAddRestaurantInput("rating", Number.parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-restaurant-deliveryTime">Delivery Time</Label>
                <Input
                  id="add-restaurant-deliveryTime"
                  value={addRestaurantForm.deliveryTime}
                  onChange={(e) => handleAddRestaurantInput("deliveryTime", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-restaurant-deliveryFee">Delivery Fee</Label>
                <Input
                  id="add-restaurant-deliveryFee"
                  value={addRestaurantForm.deliveryFee}
                  onChange={(e) => handleAddRestaurantInput("deliveryFee", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-restaurant-minOrder">Minimum Order</Label>
                <Input
                  id="add-restaurant-minOrder"
                  value={addRestaurantForm.minOrder}
                  onChange={(e) => handleAddRestaurantInput("minOrder", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-restaurant-distance">Distance</Label>
                <Input
                  id="add-restaurant-distance"
                  value={addRestaurantForm.distance}
                  onChange={(e) => handleAddRestaurantInput("distance", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-restaurant-priceLevel">Price Level</Label>
                <Input
                  id="add-restaurant-priceLevel"
                  type="number"
                  value={addRestaurantForm.priceLevel}
                  onChange={(e) => handleAddRestaurantInput("priceLevel", Number.parseInt(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-restaurant-cuisines">Cuisines (comma separated)</Label>
              <Input
                id="add-restaurant-cuisines"
                value={addRestaurantForm.cuisines.join(", ")}
                onChange={(e) =>
                  handleAddRestaurantInput(
                    "cuisines",
                    e.target.value.split(",").map((v: string) => v.trim()),
                  )
                }
              />
            </div>
            {/* --- GEOLOCATION FIELDS START --- */}
            <div className="space-y-2">
              <Label htmlFor="add-restaurant-location-tag">Location Tag (Address)</Label>
              <Input
                id="add-restaurant-location-tag"
                value={addRestaurantForm.location.tag}
                onChange={(e) => handleAddLocationInput("tag", e.target.value)}
                placeholder="Search or pick on map"
              />
            </div>
            <div className="relative">
              {isAddMapLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10 rounded-md">
                  <div className="flex flex-col items-center">
                    <span className="animate-spin h-8 w-8 border-4 border-red-500 rounded-full border-t-transparent"></span>
                    <p className="mt-2 text-sm text-gray-600">Loading map...</p>
                  </div>
                </div>
              )}
              <div ref={addMapRef} className="w-full h-[300px] rounded-md border border-gray-200 bg-gray-50"></div>
            </div>
            {addMapError && <div className="text-red-500 text-sm">{addMapError}</div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-restaurant-location-lng">Longitude</Label>
                <Input
                  id="add-restaurant-location-lng"
                  type="number"
                  value={addRestaurantForm.location.coordinates[0]}
                  onChange={(e) =>
                    handleAddLocationInput("coordinates", [
                      Number.parseFloat(e.target.value),
                      addRestaurantForm.location.coordinates[1],
                    ])
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-restaurant-location-lat">Latitude</Label>
                <Input
                  id="add-restaurant-location-lat"
                  type="number"
                  value={addRestaurantForm.location.coordinates[1]}
                  onChange={(e) =>
                    handleAddLocationInput("coordinates", [
                      addRestaurantForm.location.coordinates[0],
                      Number.parseFloat(e.target.value),
                    ])
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-restaurant-open-time">Open Time</Label>
              <Input
                id="add-restaurant-open-time"
                value={addRestaurantForm.open_time}
                onChange={(e) => handleAddRestaurantInput("open_time", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-restaurant-closed-time">Closed Time</Label>
              <Input
                id="add-restaurant-closed-time"
                value={addRestaurantForm.closed_time}
                onChange={(e) => handleAddRestaurantInput("closed_time", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-restaurant-active">Active</Label>
              <Switch
                id="add-restaurant-active"
                checked={addRestaurantForm.is_active}
                onCheckedChange={(checked: any) => handleAddRestaurantInput("is_active", checked)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Restaurant</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* END Add New Restaurant Dialog */}

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="owner-profile">Owner Profile</TabsTrigger>
        </TabsList>
        {/* Restaurant Profile Tab */}
        <TabsContent value="profile" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Profile</CardTitle>
              <CardDescription>Update your restaurant information visible to customers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Display Edit Form for First Restaurant */}
              {filteredRestaurants.length > 0 && (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleAddOrUpdateRestaurant()
                    }}
                    className="space-y-6"
                  >
                    {/* Restaurant Image Preview and Input */}
                    <div className="space-y-2">
                      <Label htmlFor="restaurant-image">Restaurant Image</Label>
                      <div className="flex flex-col gap-4 w-full">
                        <Input
                          id="restaurant-image"
                          value={restaurantForm.image}
                          onChange={(e) => handleRestaurantInput("image", e.target.value)}
                          placeholder="Enter image URL"
                          disabled={!isRestaurantEditing}
                        />
                        {restaurantForm.image && (
                          <img
                            src={restaurantForm.image || "/placeholder.svg"}
                            alt="Restaurant Preview"
                            className="w-full h-60 object-cover rounded-md mt-2"
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="restaurant-name">Restaurant Name</Label>
                      <Input
                        id="restaurant-name"
                        value={restaurantForm.name}
                        onChange={(e) => handleRestaurantInput("name", e.target.value)}
                        required
                        disabled={!isRestaurantEditing}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="restaurant-rating">Rating</Label>
                        <Input
                          id="restaurant-rating"
                          type="number"
                          value={restaurantForm.rating}
                          onChange={(e) => handleRestaurantInput("rating", Number.parseFloat(e.target.value))}
                          disabled={!isRestaurantEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="restaurant-deliveryTime">Delivery Time</Label>
                        <Input
                          id="restaurant-deliveryTime"
                          value={restaurantForm.deliveryTime}
                          onChange={(e) => handleRestaurantInput("deliveryTime", e.target.value)}
                          disabled={!isRestaurantEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="restaurant-deliveryFee">Delivery Fee</Label>
                        <Input
                          id="restaurant-deliveryFee"
                          value={restaurantForm.deliveryFee}
                          onChange={(e) => handleRestaurantInput("deliveryFee", e.target.value)}
                          disabled={!isRestaurantEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="restaurant-minOrder">Minimum Order</Label>
                        <Input
                          id="restaurant-minOrder"
                          value={restaurantForm.minOrder}
                          onChange={(e) => handleRestaurantInput("minOrder", e.target.value)}
                          disabled={!isRestaurantEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="restaurant-distance">Distance</Label>
                        <Input
                          id="restaurant-distance"
                          value={restaurantForm.distance}
                          onChange={(e) => handleRestaurantInput("distance", e.target.value)}
                          disabled={!isRestaurantEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="restaurant-priceLevel">Price Level</Label>
                        <Input
                          id="restaurant-priceLevel"
                          type="number"
                          value={restaurantForm.priceLevel}
                          onChange={(e) => handleRestaurantInput("priceLevel", Number.parseInt(e.target.value))}
                          disabled={!isRestaurantEditing}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="restaurant-cuisines">Cuisines (comma separated)</Label>
                      <Input
                        id="restaurant-cuisines"
                        value={restaurantForm.cuisines.join(", ")}
                        onChange={(e) =>
                          handleRestaurantInput(
                            "cuisines",
                            e.target.value.split(",").map((v: string) => v.trim()),
                          )
                        }
                        disabled={!isRestaurantEditing}
                      />
                    </div>
                    {/* --- GEOLOCATION FIELDS START --- */}
                    <div className="space-y-2">
                      <Label htmlFor="restaurant-location-tag">Location Tag (Address)</Label>
                      <Input
                        id="restaurant-location-tag"
                        value={restaurantForm.location.tag}
                        onChange={(e) => handleLocationInput("tag", e.target.value)}
                        placeholder="Search or pick on map"
                        disabled={!isRestaurantEditing}
                      />
                    </div>
                    <div className="relative">
                      {isMapLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10 rounded-md">
                          <div className="flex flex-col items-center">
                            <span className="animate-spin h-8 w-8 border-4 border-red-500 rounded-full border-t-transparent"></span>
                            <p className="mt-2 text-sm text-gray-600">Loading map...</p>
                          </div>
                        </div>
                      )}
                      <div ref={mapRef} className="w-full h-[300px] rounded-md border border-gray-200 bg-gray-50"></div>
                    </div>
                    {mapError && <div className="text-red-500 text-sm">{mapError}</div>}
                    {/* --- GEOLOCATION FIELDS END --- */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="restaurant-location-lng">Longitude</Label>
                        <Input
                          id="restaurant-location-lng"
                          type="number"
                          value={restaurantForm.location.coordinates[0]}
                          onChange={(e) =>
                            handleLocationInput("coordinates", [
                              Number.parseFloat(e.target.value),
                              restaurantForm.location.coordinates[1],
                            ])
                          }
                          disabled={!isRestaurantEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="restaurant-location-lat">Latitude</Label>
                        <Input
                          id="restaurant-location-lat"
                          type="number"
                          value={restaurantForm.location.coordinates[1]}
                          onChange={(e) =>
                            handleLocationInput("coordinates", [
                              restaurantForm.location.coordinates[0],
                              Number.parseFloat(e.target.value),
                            ])
                          }
                          disabled={!isRestaurantEditing}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="restaurant-open-time">Open Time</Label>
                      <Input
                        id="restaurant-open-time"
                        value={restaurantForm.open_time}
                        onChange={(e) => handleRestaurantInput("open_time", e.target.value)}
                        disabled={!isRestaurantEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="restaurant-closed-time">Closed Time</Label>
                      <Input
                        id="restaurant-closed-time"
                        value={restaurantForm.closed_time}
                        onChange={(e) => handleRestaurantInput("closed_time", e.target.value)}
                        disabled={!isRestaurantEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="restaurant-active">Active</Label>
                      <Switch
                        id="restaurant-active"
                        checked={restaurantForm.is_active}
                        onCheckedChange={(checked: any) => handleRestaurantInput("is_active", checked)}
                        disabled={!isRestaurantEditing}
                      />
                    </div>
                    <div className="flex justify-between gap-4">
                      <Button variant="destructive" onClick={handleDeleteRestaurant} disabled={isRestaurantEditing}>
                        Delete Restaurant
                      </Button>
                      {isRestaurantEditing ? (
                        <>
                          <Button type="button" variant="outline" onClick={() => setIsRestaurantEditing(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">Save Changes</Button>
                        </>
                      ) : (
                        <Button type="button" onClick={() => setIsRestaurantEditing(true)}>
                          Update Restaurant
                        </Button>
                      )}
                    </div>
                  </form>
                </>
              )}
              {filteredRestaurants.length === 0 && (
                <div className="text-muted-foreground">No restaurants found for this owner.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Owner Profile Tab */}
        <TabsContent value="owner-profile" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Owner Profile</CardTitle>
              <CardDescription>
                Manage your account information
                {owner.restaurantName && ` - ${owner.restaurantName}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div>Loading owner info...</div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="owner-name">Owner Name</Label>
                    <Input
                      id="owner-name"
                      value={owner.name}
                      onChange={(e) => setOwner({ ...owner, name: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-email">Owner Email</Label>
                    <Input
                      id="owner-email"
                      value={owner.email}
                      onChange={(e) => setOwner({ ...owner, email: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-phone">Owner Phone</Label>
                    <Input
                      id="owner-phone"
                      value={owner.phone}
                      onChange={(e) => setOwner({ ...owner, phone: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-address">Owner Address</Label>
                    <Input
                      id="owner-address"
                      value={owner.address}
                      onChange={(e) => setOwner({ ...owner, address: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-restaurant">Restaurant Name</Label>
                    <Input
                      id="owner-restaurant"
                      value={owner.restaurantName}
                      onChange={(e) => setOwner({ ...owner, restaurantName: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  {isEditing && (
                    <div className="space-y-2">
                      <Label htmlFor="owner-password">Confirm Password</Label>
                      <Input
                        id="owner-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-between gap-4">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveOwner}>Save Changes</Button>
                </>
              ) : (
                <>
                  <Button variant="destructive" onClick={handleDeleteOwner}>
                    Delete Account
                  </Button>
                  <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
                </>
              )}
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
