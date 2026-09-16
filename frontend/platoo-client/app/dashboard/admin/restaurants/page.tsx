"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs } from "@/components/ui/tabs"
import {
  Search,
  MoreHorizontal,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Star,
} from "lucide-react"

interface Restaurant {
  location: {
    type: string
    coordinates: [number, number]
    tag: string
  }
  _id: string
  name: string
  image: string
  rating: number
  deliveryTime: string
  deliveryFee: string
  minOrder: string
  distance: string
  cuisines: string[]
  priceLevel: number
  status: "approved" | "rejected" | "pending"
  open_time: string
  closed_time: string
  createdAt: string
  updatedAt: string
  __v: number
}

export default function RestaurantsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [cuisineFilter, setCuisineFilter] = useState("all")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)

  // Status filter: "all", "approved", "rejected"
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "rejected">("all")

  // Modal state for restaurant details
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [detailsRestaurant, setDetailsRestaurant] = useState<Restaurant | null>(null)

  useEffect(() => {
    const fetchRestaurants = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("http://localhost:3001/api/restaurants")
        if (!response.ok) {
          throw new Error(`Failed to fetch restaurants: ${response.statusText}`)
        }
        // Convert is_active to status for compatibility
        const data = (await response.json()).map((r: any) => ({
          ...r,
          status: r.status
            ? r.status
            : r.is_active === true
            ? "approved"
            : r.is_active === false
            ? "rejected"
            : "pending",
        }))
        setRestaurants(data)
        setFilteredRestaurants(data)
      } catch (error) {
        console.error("Error fetching restaurants:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchRestaurants()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [searchQuery, cuisineFilter, statusFilter, restaurants])

  const applyFilters = () => {
    let filtered = [...restaurants]
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (restaurant) =>
          restaurant.name.toLowerCase().includes(query) ||
          restaurant._id.toLowerCase().includes(query) ||
          restaurant.cuisines.some((c) => c.toLowerCase().includes(query)) ||
          restaurant.location.tag.toLowerCase().includes(query)
      )
    }
    if (cuisineFilter !== "all") {
      filtered = filtered.filter((restaurant) =>
        restaurant.cuisines.some((cuisine) => cuisine.toLowerCase() === cuisineFilter.toLowerCase())
      )
    }
    if (statusFilter === "approved") {
      filtered = filtered.filter((restaurant) => restaurant.status === "approved")
    } else if (statusFilter === "rejected") {
      filtered = filtered.filter((restaurant) => restaurant.status === "rejected")
    }
    setFilteredRestaurants(filtered)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    applyFilters()
  }

  const handleDeleteRestaurant = () => {
    if (!selectedRestaurant) return
    setRestaurants((prev) => prev.filter((restaurant) => restaurant._id !== selectedRestaurant._id))
    setIsDeleteDialogOpen(false)
    setSelectedRestaurant(null)
  }

  const cuisineTypes = [
    "All",
    ...Array.from(
      new Set(
        restaurants
          .flatMap((r) => r.cuisines)
          .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
      )
    ),
  ]

  // Helper: fallback to placeholder if image fails
  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = "https://via.placeholder.com/40x40?text=No+Image"
  }

  // Open details modal
  const handleViewDetails = (restaurant: Restaurant) => {
    setDetailsRestaurant(restaurant)
    setShowDetailsModal(true)
  }

  // Approve/Reject handlers
  const handleApprove = async (restaurant: Restaurant) => {
    try {
      await fetch(`http://localhost:3001/api/restaurants/${restaurant._id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      })
      setRestaurants((prev) =>
        prev.map((r) =>
          r._id === restaurant._id ? { ...r, status: "approved" } : r
        )
      )
      setFilteredRestaurants((prev) =>
        prev.map((r) =>
          r._id === restaurant._id ? { ...r, status: "approved" } : r
        )
      )
    } catch (err) {
      alert("Failed to approve restaurant.")
    }
  }

  const handleReject = async (restaurant: Restaurant) => {
    try {
      await fetch(`http://localhost:3001/api/restaurants/${restaurant._id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      })
      setRestaurants((prev) =>
        prev.map((r) =>
          r._id === restaurant._id ? { ...r, status: "rejected" } : r
        )
      )
      setFilteredRestaurants((prev) =>
        prev.map((r) =>
          r._id === restaurant._id ? { ...r, status: "rejected" } : r
        )
      )
    } catch (err) {
      alert("Failed to reject restaurant.")
    }
  }

  // Status badge color and label
  const getStatusBadge = (status: string) => {
    if (status === "approved")
      return <Badge className="bg-green-500 text-white">Approved</Badge>
    if (status === "rejected")
      return <Badge className="bg-red-500 text-white">Rejected</Badge>
    return <Badge className="bg-gray-400 text-white">Pending</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Restaurant Management</h1>
        <p className="text-muted-foreground">Manage all restaurants on your platform</p>
      </div>
      {/* Status filter buttons */}
      <div className="flex gap-2 mb-2">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          onClick={() => setStatusFilter("all")}
        >
          All
        </Button>
        <Button
          variant={statusFilter === "approved" ? "default" : "outline"}
          onClick={() => setStatusFilter("approved")}
        >
          Approved
        </Button>
        <Button
          variant={statusFilter === "rejected" ? "default" : "outline"}
          onClick={() => setStatusFilter("rejected")}
        >
          Rejected
        </Button>
      </div>
      <Tabs defaultValue="all" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="w-full sm:max-w-sm">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                     type="search"
                     placeholder="Search by name, restaurant id, cuisine, or location..."
                     className="pl-8 w-full"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </form>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={cuisineFilter} onValueChange={setCuisineFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by cuisine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cuisines</SelectItem>
                    {cuisineTypes
                      .filter((c) => c.toLowerCase() !== "all")
                      .map((cuisine) => (
                        <SelectItem key={cuisine.toLowerCase()} value={cuisine.toLowerCase()}>
                          {cuisine}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <p>Loading restaurants...</p>
              </div>
            ) : filteredRestaurants.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Cuisines</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRestaurants.map((restaurant) => (
                    <TableRow key={restaurant._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-md overflow-hidden">
                            <img
                              src={restaurant.image || "https://via.placeholder.com/40x40?text=No+Image"}
                              alt={restaurant.name}
                              className="h-full w-full object-cover"
                              onError={handleImgError}
                            />
                          </div>
                          <div>
                            <div className="font-medium">{restaurant.name}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              ID: {restaurant._id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{restaurant.location.tag}</div>
                          <div className="text-xs text-muted-foreground">
                            [{restaurant.location.coordinates.join(", ")}]
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {restaurant.cuisines.map((type, idx) => (
                            <Badge key={idx} variant="outline" className="bg-muted/50">{type}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                          <span>{restaurant.rating}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>
                            <span>{restaurant.deliveryTime}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Fee: {restaurant.deliveryFee} | Min: {restaurant.minOrder}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Dist: {restaurant.distance}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(restaurant.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => handleViewDetails(restaurant)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-green-600"
                              onClick={() => handleApprove(restaurant)}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleReject(restaurant)}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedRestaurant(restaurant)
                                setIsDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No restaurants found</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("")
                    setCuisineFilter("all")
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </Tabs>
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this restaurant? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedRestaurant && (
              <div className="flex items-center gap-3 p-3 border rounded-md">
                <div className="h-10 w-10 rounded-md overflow-hidden">
                  <img
                    src={selectedRestaurant.image || "https://via.placeholder.com/40x40?text=No+Image"}
                    alt={selectedRestaurant.name}
                    className="h-full w-full object-cover"
                    onError={handleImgError}
                  />
                </div>
                <div>
                  <div className="font-medium">{selectedRestaurant.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedRestaurant.location.tag}</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteRestaurant}>
              Delete Restaurant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* View Details Dialog */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="sm:max-w-xl bg-white rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold mb-2 text-blue-700">Restaurant Details</DialogTitle>
            <DialogDescription className="mb-4 text-gray-500">
              All information about this restaurant.
            </DialogDescription>
          </DialogHeader>
          {detailsRestaurant && (
            <div className="space-y-6">
              <div className="flex items-center gap-6 border-b pb-4">
                <img
                  src={detailsRestaurant.image || "https://via.placeholder.com/80x80?text=No+Image"}
                  alt={detailsRestaurant.name}
                  className="w-24 h-24 rounded-lg object-cover border shadow"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://via.placeholder.com/80x80?text=No+Image";
                  }}
                />
                <div>
                  <div className="font-bold text-xl text-gray-800">{detailsRestaurant.name}</div>
                  <div className="text-xs text-gray-400 mb-2">ID: {detailsRestaurant._id}</div>
                  <div className="flex flex-wrap gap-2">
                    {detailsRestaurant.cuisines.map((c, i) => (
                      <Badge key={i} variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold text-gray-700">Location</div>
                  <div className="text-gray-800">{detailsRestaurant.location.tag}</div>
                  <div className="text-xs text-gray-400">
                    [{detailsRestaurant.location.coordinates.join(", ")}]
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Status</div>
                  {getStatusBadge(detailsRestaurant.status)}
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Rating</div>
                  <div className="flex items-center gap-1 text-yellow-600 font-semibold">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{detailsRestaurant.rating}</span>
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Delivery Time</div>
                  <span className="text-gray-800">{detailsRestaurant.deliveryTime}</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Delivery Fee</div>
                  <span className="text-gray-800">{detailsRestaurant.deliveryFee}</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Min Order</div>
                  <span className="text-gray-800">{detailsRestaurant.minOrder}</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Distance</div>
                  <span className="text-gray-800">{detailsRestaurant.distance}</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-700">Open Hours</div>
                  <span className="text-gray-800">
                    {detailsRestaurant.open_time} - {detailsRestaurant.closed_time}
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-400 border-t pt-4">
                Created: {new Date(detailsRestaurant.createdAt).toLocaleString()}<br />
                Updated: {new Date(detailsRestaurant.updatedAt).toLocaleString()}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
