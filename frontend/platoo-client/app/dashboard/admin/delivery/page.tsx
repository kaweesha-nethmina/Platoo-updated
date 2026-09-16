"use client"

import { useState, useEffect } from "react"
import { format, isSameDay } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, MapPin, Truck, User, Phone, Mail, Calendar as CalendarIcon, Edit, Bike, Car, Star, PackageCheck, CheckCircle, Clock } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

interface DeliveryPerson {
  // address: string // <-- REMOVED
  createdAt: any
  vehicleNumber: string
  id: string
  name?: string
  email?: string
  phone?: string
  status: "active" | "inactive" | "on_delivery"
  rating: number
  totalDeliveries: number
  vehicleType: "bike" | "scooter" | "car"
  location?: {
    lat: number
    lng: number
    lastUpdated: string
  }
  avatar?: string
  address?: string // Keep optional for details/edit forms
}

interface Delivery {
  id: string
  orderId: string
  restaurantName: string
  customerName: string
  customerAddress: string
  deliveryStatus: string
  assignedTo?: string | null
  pickupTime: string
  deliveryTime: string
  createdAt: string
  updatedAt: string
}

// ======================== DatePicker Component ========================
function DatePicker({
  selected,
  onSelect,
  placeholder = "Pick a date",
  className,
}: {
  selected: Date | null
  onSelect: (date: Date | null) => void
  placeholder?: string
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[180px] justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected || undefined}
          onSelect={(date) => onSelect(date || null)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

// ======================== Main Component ========================
export default function AdminDeliveryDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [deliveryPersonnel, setDeliveryPersonnel] = useState<DeliveryPerson[]>([])
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([])
  const [selectedDeliveryPerson, setSelectedDeliveryPerson] = useState<DeliveryPerson | null>(null)
  const [deliveryPersonnelFilter, setDeliveryPersonnelFilter] = useState("all")
  const [deliveriesFilter, setDeliveriesFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    vehicleNumber: "",
    status: "inactive" as "active" | "inactive" | "on_delivery",
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState("")

  // Date filter state
  const [personnelDate, setPersonnelDate] = useState<Date | null>(null)
  const [deliveriesDate, setDeliveriesDate] = useState<Date | null>(null)

  // Edit handlers
  const openEdit = (person: DeliveryPerson) => {
    setEditForm({
      name: person.name || "",
      email: person.email || "",
      phone: person.phone || "",
      address: person.address || "",
      vehicleNumber: person.vehicleNumber || "",
      status: person.status,
    })
    setIsEditing(true)
  }

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setEditForm((prev) => ({
      ...prev,
      [name]: name === "status"
        ? value as "active" | "inactive" | "on_delivery"
        : value,
    }))
  }

  const handleEditSubmit = async () => {
    if (!selectedDeliveryPerson) return
    setEditLoading(true)
    setEditError("")
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(
        `http://localhost:4000/api/auth/update/${selectedDeliveryPerson.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(editForm),
        }
      )
      if (!res.ok) throw new Error("Failed to update user")
      setSelectedDeliveryPerson((prev) =>
        prev ? { ...prev, ...editForm } : prev
      )
      setDeliveryPersonnel((prev) =>
        prev.map((p) =>
          p.id === selectedDeliveryPerson.id ? { ...p, ...editForm } : p
        )
      )
      setIsEditing(false)
    } catch (e) {
      setEditError("Update failed. Please try again.")
    } finally {
      setEditLoading(false)
    }
  }

  // Fetch delivery personnel
  useEffect(() => {
    async function fetchDeliveryPersonnel() {
      setIsLoading(true)
      try {
        const token = localStorage.getItem("token")
        const res = await fetch("http://localhost:4000/api/auth/users", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
        if (!res.ok) throw new Error("Failed to fetch users")
        const users = await res.json()
        const deliveryPersons = users.filter(
          (user: any) => user.role === "delivery_man"
        )
        setDeliveryPersonnel(
          deliveryPersons.map((item: any) => ({
            id: item._id,
            name: item.name || "",
            email: item.email || "",
            phone: item.phone || "",
            status: item.status || "active",
            rating: item.rating ?? 4.5,
            totalDeliveries: item.totalDeliveries ?? 0,
            vehicleType: item.vehicleNumber ? "bike" : "bike",
            vehicleNumber: item.vehicleNumber || "",
            address: item.address || "",
            restaurantName: item.restaurantName || "",
            createdAt: item.createdAt || "",
            location: item.location,
            avatar: item.avatar,
          }))
        )
      } catch (e) {
        setDeliveryPersonnel([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchDeliveryPersonnel()
  }, [])

  // Fetch deliveries
  useEffect(() => {
    async function fetchDeliveries() {
      setIsLoading(true)
      try {
        const res = await fetch("http://localhost:3003/api/delivery");
        const data = await res.json();
        setActiveDeliveries(data.map((item: any) => ({
          id: item._id,
          orderId: item.orderId || "",
          restaurantName: item.restaurantName || "",
          customerName: item.customerName || "",
          customerAddress: item.deliveryAddress || "",
          deliveryStatus: item.deliveryStatus || "pending",
          assignedTo: item.assignedTo,
          pickupTime: item.pickupTime || "",
          deliveryTime: item.deliveryTime || "",
          createdAt: item.createdAt || "",
          updatedAt: item.updatedAt || "",
        })));
      } catch (e) {
        setActiveDeliveries([]);
      }
      setIsLoading(false);
    }
    fetchDeliveries();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500"
      case "inactive": return "bg-gray-500"
      case "on_delivery": return "bg-blue-500"
      case "pending": return "bg-yellow-500"
      case "assigned": return "bg-purple-500"
      case "picked_up": return "bg-indigo-500"
      case "in_transit": return "bg-blue-500"
      case "delivered": return "bg-green-500"
      case "failed": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case "bike": return <Bike className="h-4 w-4" />
      case "scooter": return <Bike className="h-4 w-4" />
      case "car": return <Car className="h-4 w-4" />
      default: return <Truck className="h-4 w-4" />
    }
  }

  // Filter logic with date filters
  const filteredDeliveryPersonnel = deliveryPersonnel.filter((person) => {
    if (deliveryPersonnelFilter !== "all" && person.status !== deliveryPersonnelFilter) {
      return false
    }
    if (personnelDate && person.createdAt) {
      const joinDate = new Date(person.createdAt)
      if (!isSameDay(joinDate, personnelDate)) return false
    }
    if (searchQuery) {
      return (
        person.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.phone?.includes(searchQuery)
      )
    }
    return true
  })

  const filteredDeliveries = activeDeliveries.filter((delivery) => {
    if (deliveriesFilter !== "all" && delivery.deliveryStatus !== deliveriesFilter) {
      return false
    }
    if (deliveriesDate && delivery.deliveryTime) {
      const deliveryDate = new Date(delivery.deliveryTime)
      if (!isSameDay(deliveryDate, deliveriesDate)) return false
    }
    if (searchQuery) {
      return (
        delivery.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        delivery.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        delivery.id?.toLowerCase().includes(searchQuery)
      )
    }
    return true
  })

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 flex flex-col gap-6 w-full">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 w-full">
          {Array(2)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-2 w-full">
        <h1 className="text-3xl font-bold tracking-tight">Delivery Management</h1>
        <p className="text-muted-foreground">
          Manage delivery personnel and track active deliveries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Delivery Personnel</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryPersonnel.length}</div>
          </CardContent>
        </Card>
        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deliveries</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDeliveries.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeDeliveries.filter((d) => d.deliveryStatus === "pending").length} pending,{" "}
              {activeDeliveries.filter((d) => ["assigned", "picked_up", "in_transit"].includes(d.deliveryStatus)).length} in progress
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="personnel" className="space-y-4 w-full">
        <TabsList className="w-full flex">
          <TabsTrigger value="personnel" className="flex-1">Delivery Personnel</TabsTrigger>
          <TabsTrigger value="deliveries" className="flex-1">Active Deliveries</TabsTrigger>
        </TabsList>

        {/* =================== Delivery Personnel Table =================== */}
        <TabsContent value="personnel" className="space-y-4 w-full">
          <div className="flex flex-wrap gap-2 items-center w-full">
            <DatePicker
              selected={personnelDate}
              onSelect={setPersonnelDate}
              placeholder="Filter by join date"
            />
            <Button variant="outline" onClick={() => setPersonnelDate(null)} disabled={!personnelDate}>
              Clear
            </Button>
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search personnel..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <Card className="w-full">
            <CardContent className="p-0 w-full">
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[950px] w-full border-separate border-spacing-0">
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">ID</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Name</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Contact</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Vehicle</TableHead>
                      {/* <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Address</TableHead> */}
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Joined</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Status</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeliveryPersonnel.map((person, idx) => (
                      <TableRow key={person.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <TableCell className="px-4 py-3 font-mono text-xs text-gray-800 border-b border-gray-100">{person.id}</TableCell>
                        <TableCell className="px-4 py-3 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium">{person.name || "Unnamed"}</div>
                              <div className="text-xs text-gray-500">{person.email || "No email"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 border-b border-gray-100">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">{person.phone || "-"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            {getVehicleIcon(person.vehicleType)}
                            <span>{person.vehicleNumber || "-"}</span>
                          </div>
                        </TableCell>
                        {/* <TableCell className="px-4 py-3 border-b border-gray-100">
                          {person.address || "-"}
                        </TableCell> */}
                        <TableCell className="px-4 py-3 border-b border-gray-100">
                          {person.createdAt ? new Date(person.createdAt).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 border-b border-gray-100">
                          <Badge className={`${getStatusColor(person.status)} text-white text-xs px-2 py-0.5 rounded`}>
                            {person.status === "active"
                              ? "Active"
                              : person.status === "inactive"
                                ? "Inactive"
                                : "On Delivery"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 border-b border-gray-100">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 px-3 py-1 rounded-md border-blue-500 hover:bg-blue-50 transition"
                            onClick={() => setSelectedDeliveryPerson(person)}
                          >
                            <User className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold text-blue-700">View</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== Active Deliveries Table =================== */}
        <TabsContent value="deliveries" className="space-y-4 w-full">
          <div className="flex flex-wrap gap-2 items-center w-full">
            <DatePicker
              selected={deliveriesDate}
              onSelect={setDeliveriesDate}
              placeholder="Filter by delivery date"
            />
            <Button variant="outline" onClick={() => setDeliveriesDate(null)} disabled={!deliveriesDate}>
              Clear
            </Button>
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search deliveries..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={deliveriesFilter} onValueChange={setDeliveriesFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="picked_up">Picked Up</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card className="w-full">
            <CardContent className="p-0 w-full">
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[1100px] w-full border-separate border-spacing-0">
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Order ID</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Restaurant</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Customer</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Delivery Person</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Status</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Pickup Time</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Delivery Time</TableHead>
                      <TableHead className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeliveries.map((delivery, idx) => {
                      const assignedPerson = deliveryPersonnel.find(p => p.id === delivery.assignedTo)
                      return (
                        <TableRow key={delivery.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <TableCell className="px-4 py-3 font-mono text-xs text-gray-800 border-b border-gray-100">{delivery.orderId}</TableCell>
                          <TableCell className="px-4 py-3 border-b border-gray-100">{delivery.restaurantName}</TableCell>
                          <TableCell className="px-4 py-3 border-b border-gray-100">
                            <div className="flex flex-col">
                              <div className="font-medium">{delivery.customerName}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[150px]">{delivery.customerAddress}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 border-b border-gray-100">
                            {assignedPerson ? (
                              <div className="flex items-center gap-2">
                                <span>{assignedPerson.name || "Unnamed"}</span>
                              </div>
                            ) : (
                              <Badge variant="outline">Unassigned</Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 border-b border-gray-100">
                            <Badge className={`${getStatusColor(delivery.deliveryStatus)} text-white`}>
                              {delivery.deliveryStatus.charAt(0).toUpperCase() + delivery.deliveryStatus.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 border-b border-gray-100">
                            {delivery.pickupTime ? new Date(delivery.pickupTime).toLocaleTimeString() : "-"}
                          </TableCell>
                          <TableCell className="px-4 py-3 border-b border-gray-100">
                            {delivery.deliveryTime ? new Date(delivery.deliveryTime).toLocaleTimeString() : "-"}
                          </TableCell>
                          <TableCell className="px-4 py-3 border-b border-gray-100">
                            {delivery.createdAt ? new Date(delivery.createdAt).toLocaleTimeString() : "-"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delivery Person Details Dialog */}
      {selectedDeliveryPerson && (
        <Dialog open={!!selectedDeliveryPerson} onOpenChange={() => { setSelectedDeliveryPerson(null); setIsEditing(false); }}>
          <DialogContent className="sm:max-w-[520px] rounded-xl shadow-xl border-0 p-0 overflow-hidden">
            <DialogTitle className="sr-only">
              {selectedDeliveryPerson.name || "Delivery Person Details"}
            </DialogTitle>
            <div className="bg-gradient-to-r from-blue-700 to-blue-400 rounded-t-xl px-8 py-6 flex items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border-4 border-blue-200 shadow">
                  <User className="h-8 w-8 text-blue-500" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">
                  {selectedDeliveryPerson.name || "Unnamed"}
                </h2>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`${getStatusColor(selectedDeliveryPerson.status)} text-white text-xs px-2 py-0.5 rounded`}>
                    {selectedDeliveryPerson.status === "active"
                      ? "Active"
                      : selectedDeliveryPerson.status === "inactive"
                        ? "Inactive"
                        : "On Delivery"}
                  </Badge>
                  <span className="text-xs text-blue-100 font-mono">
                    ID: {selectedDeliveryPerson.id}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-blue-100 text-xs">
                    <Star className="h-4 w-4 text-yellow-300" />
                    <span className="font-semibold text-white">{selectedDeliveryPerson.rating.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-blue-100 text-xs">
                    <CheckCircle className="h-4 w-4 text-green-200" />
                    <span className="font-semibold text-white capitalize">{selectedDeliveryPerson.vehicleType}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-8 py-8 bg-white rounded-b-xl">
              {!isEditing ? (
                <>
                  <div className="max-w-xl mx-auto">
                    <h4 className="font-semibold text-gray-700 mb-4">Contact</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm text-gray-700 shadow-sm border border-gray-100 mb-8">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Email:</span>
                        <span>{selectedDeliveryPerson.email || <span className="italic text-gray-400">No email</span>}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Phone:</span>
                        <span>{selectedDeliveryPerson.phone || <span className="italic text-gray-400">Not provided</span>}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Address:</span>
                        <span>{selectedDeliveryPerson.address || <span className="italic text-gray-400">Not provided</span>}</span>
                      </div>
                    </div>
                    <h4 className="font-semibold text-gray-700 mb-4">Delivery Info</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm text-gray-700 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-3">
                        <Truck className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Vehicle No:</span>
                        <span>{selectedDeliveryPerson.vehicleNumber || <span className="italic text-gray-400">Not provided</span>}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Joined:</span>
                        <span>
                          {selectedDeliveryPerson.createdAt
                            ? new Date(selectedDeliveryPerson.createdAt).toLocaleDateString()
                            : <span className="italic text-gray-400">Not available</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {getVehicleIcon(selectedDeliveryPerson.vehicleType)}
                        <span className="font-medium">Vehicle Type:</span>
                        <span>{selectedDeliveryPerson.vehicleType}</span>
                      </div>
                      {selectedDeliveryPerson.location && (
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">Location:</span>
                          <span>
                            {selectedDeliveryPerson.location.lat}, {selectedDeliveryPerson.location.lng}
                          </span>
                        </div>
                      )}
                      {selectedDeliveryPerson.location?.lastUpdated && (
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">Last Location Update:</span>
                          <span>
                            {format(new Date(selectedDeliveryPerson.location.lastUpdated), "PPPpp")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-10 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(selectedDeliveryPerson)}
                      className="flex items-center gap-2"
                    >
                      <Edit className="mr-2 h-4 w-4" /> Edit
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedDeliveryPerson(null)}>
                      Close
                    </Button>
                  </div>
                </>
              ) : (
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    handleEditSubmit()
                  }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">Name</Label>
                        <Input
                          name="name"
                          value={editForm.name}
                          onChange={handleEditChange}
                          required
                        />
                      </div>
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">Email</Label>
                        <Input
                          name="email"
                          type="email"
                          value={editForm.email}
                          onChange={handleEditChange}
                          required
                        />
                      </div>
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">Phone</Label>
                        <Input
                          name="phone"
                          value={editForm.phone}
                          onChange={handleEditChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">Address</Label>
                        <Input
                          name="address"
                          value={editForm.address}
                          onChange={handleEditChange}
                        />
                      </div>
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</Label>
                        <Input
                          name="vehicleNumber"
                          value={editForm.vehicleNumber}
                          onChange={handleEditChange}
                        />
                      </div>
                    </div>
                  </div>
                  {editError && <div className="text-red-500 text-sm">{editError}</div>}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={editLoading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={editLoading}>
                      {editLoading ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
