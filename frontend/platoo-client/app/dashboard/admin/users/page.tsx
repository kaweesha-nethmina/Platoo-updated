"use client"

import { useState, useEffect, JSX } from "react"
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
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  AlertCircle,
  Eye,
  Mail,
  User,
  KeyRound,
  Phone,
  MapPin,
  Building2,
  Truck,
  UserCircle,
  Shield,
} from "lucide-react"

interface User {
  restaurantName: string
  vehicleNumber: string
  id: string
  name: string
  email: string
  role: string
  orders?: number
  avatar?: string
  phone?: string
  address?: string
}

export default function UsersPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false)
  const [viewUser, setViewUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "admin",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
  })

  const fieldIcons: Record<string, JSX.Element> = {
    _id: <KeyRound className="text-gray-400 w-4 h-4 mr-1" />,
    name: <UserCircle className="text-blue-500 w-4 h-4 mr-1" />,
    email: <Mail className="text-teal-500 w-4 h-4 mr-1" />,
    password: <Shield className="text-yellow-500 w-4 h-4 mr-1" />,
    role: <User className="text-purple-500 w-4 h-4 mr-1" />,
    phone: <Phone className="text-green-500 w-4 h-4 mr-1" />,
    address: <MapPin className="text-pink-500 w-4 h-4 mr-1" />,
    restaurantName: <Building2 className="text-orange-500 w-4 h-4 mr-1" />,
    vehicleNumber: <Truck className="text-indigo-500 w-4 h-4 mr-1" />,
    createdAt: <KeyRound className="text-gray-500 w-4 h-4 mr-1" />,
    __v: <Shield className="text-gray-400 w-4 h-4 mr-1" />,
  }

  const roleColors: Record<string, string> = {
    admin: "from-purple-100 to-purple-50 border-purple-400",
    user: "from-blue-100 to-blue-50 border-blue-400",
    restaurant_owner: "from-orange-100 to-orange-50 border-orange-400",
    delivery_man: "from-green-100 to-green-50 border-green-400",
  }

  const DetailRow = ({
    label,
    value,
    mono = false,
  }: {
    label: string
    value: React.ReactNode
    mono?: boolean
  }) => (
    <div className="flex items-center py-2 px-2 rounded hover:bg-gray-50 transition-all">
      <dt className="w-40 flex items-center font-semibold text-gray-700 capitalize">
        {fieldIcons[label] || null}
        <span className="ml-1">{label}:</span>
      </dt>
      <dd className={`flex-1 text-gray-900 ${mono ? "font-mono text-xs" : "font-medium"} break-all`}>
        {value}
      </dd>
    </div>
  )

  function validatePassword(password: string): string | null {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+={}[\]|\\:;"'<>,.?/~`]).{8,}$/
    if (!password) return "Password is required"
    if (!regex.test(password))
      return "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
    return null
  }

  useEffect(() => {
    const fetchUsersAndOrders = async () => {
      setIsLoading(true)
      try {
        const token = localStorage.getItem("token")
        const usersRes = await fetch("http://localhost:4000/api/auth/users", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
        if (!usersRes.ok) throw new Error("Failed to fetch users")
        const usersData = await usersRes.json()
        const mappedUsers = usersData.map((user: any) => ({
          ...user,
          id: user._id || user.id,
        }))

        const ordersRes = await fetch("http://localhost:3008/api/orders", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })
        if (!ordersRes.ok) throw new Error("Failed to fetch orders")
        const ordersData = await ordersRes.json()

        const usersWithOrders = mappedUsers.map((user: any) => {
          if (user.role === "user") {
            const orderCount = ordersData.filter(
              (order: any) => order.user_id === user.id
            ).length
            return { ...user, orders: orderCount }
          }
          return user
        })

        setUsers(usersWithOrders)
        setFilteredUsers(usersWithOrders)
      } catch (error) {
        console.error("Error fetching users or orders:", error)
        setUsers([])
        setFilteredUsers([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsersAndOrders()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [searchQuery, roleFilter, users])

  const applyFilters = () => {
    let filtered = [...users]
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.id.toLowerCase().includes(query)
      )
    }
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter)
    }
    setFilteredUsers(filtered)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    applyFilters()
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const passwordError = validatePassword(newUser.password)
    if (passwordError) {
      alert(passwordError)
      return
    }
    if (newUser.password !== newUser.confirmPassword) {
      alert("Passwords do not match")
      return
    }

    try {
      const res = await fetch("http://localhost:4000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          phone: newUser.phone,
          address: newUser.address,
          role: "admin",
        }),
      })

      const contentType = res.headers.get("content-type")
      let result: any = {}
      if (contentType && contentType.includes("application/json")) {
        result = await res.json()
      } else {
        const text = await res.text()
        alert(text || "Failed to register admin")
        return
      }
      if (!res.ok) {
        alert(result?.error || result?.message || "Failed to register admin")
        return
      }

      // Send email
      const emailRes = await fetch("http://localhost:4005/api/email/send-admin-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newUser.email,
          name: newUser.name,
          password: newUser.password,
        }),
      })

      if (!emailRes.ok) {
        alert("Admin created but email failed to send")
      }

      // Update state
      setUsers((prev) => [
        {
          id: result._id || `USR-${Math.floor(1000 + Math.random() * 9000)}`,
          name: newUser.name,
          email: newUser.email,
          role: "admin",
          orders: 0,
          avatar: "/placeholder.svg?height=40&width=40",
          phone: newUser.phone,
          address: newUser.address,
          vehicleNumber: "",
          restaurantName: "",
        },
        ...prev,
      ])

      // Reset form
      setNewUser({
        name: "",
        email: "",
        role: "admin",
        password: "",
        confirmPassword: "",
        phone: "",
        address: "",
      })
      setIsAddUserOpen(false)
      alert("Admin registered successfully! Login email sent.")
    } catch (err: any) {
      alert("Error registering admin: " + err.message)
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser?.id) {
      alert("No user selected for deletion.")
      return
    }
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`http://localhost:4000/api/auth/delete/${selectedUser.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await res.json()
      if (!res.ok) {
        alert(result?.error || result?.message || "Failed to delete user")
        return
      }

      setUsers((prev) => prev.filter((user) => user.id !== selectedUser.id))
      setIsDeleteDialogOpen(false)
      setSelectedUser(null)
      alert("User deleted successfully!")
    } catch (err: any) {
      alert("Error deleting user: " + err.message)
    }
  }

  // Edit User Logic
  const openEditUser = (user: User) => {
    setEditUser(user)
    setIsEditUserOpen(true)
  }

  const handleEditUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editUser) return
    setEditUser({ ...editUser, [e.target.name]: e.target.value })
  }

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return

    const payload: any = {
      name: editUser.name,
      email: editUser.email,
    }

    if (editUser.role === "admin") {
      payload.phone = editUser.phone
      payload.address = editUser.address
    }
    if (editUser.role === "restaurant_owner") {
      payload.phone = editUser.phone
      payload.address = editUser.address
      payload.restaurantName = editUser.restaurantName
    }
    if (editUser.role === "delivery_man") {
      payload.phone = editUser.phone
      payload.address = editUser.address
      payload.vehicleNumber = editUser.vehicleNumber
    }
    payload.role = editUser.role

    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`http://localhost:4000/api/auth/update/${editUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) {
        alert(result?.error || result?.message || "Failed to update user")
        return
      }
      const updatedUser = { ...result, id: result._id || result.id }
      setUsers((prev) =>
        prev.map((u) => (u.id === editUser.id ? { ...u, ...updatedUser } : u))
      )
      setIsEditUserOpen(false)
      setEditUser(null)
    } catch (err: any) {
      alert("Error updating user: " + err.message)
    }
  }

  // View Details Logic
  const openViewDetails = (user: User) => {
    setViewUser(user)
    setIsViewDetailsOpen(true)
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "user":
        return "bg-blue-500"
      case "restaurant_owner":
        return "bg-orange-500"
      case "delivery_man":
        return "bg-green-500"
      case "admin":
        return "bg-purple-500"
      default:
        return "bg-gray-500"
    }
  }

  const getRoleName = (role: string) => {
    switch (role) {
      case "user":
        return "Customer"
      case "restaurant_owner":
        return "Restaurant Owner"
      case "delivery_man":
        return "Delivery Person"
      case "admin":
        return "Admin"
      default:
        return role
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
      </div>

      <Tabs value={roleFilter} onValueChange={setRoleFilter} className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="all">All Users</TabsTrigger>
            <TabsTrigger value="user">Customers</TabsTrigger>
            <TabsTrigger value="restaurant_owner">Restaurant Owners</TabsTrigger>
            <TabsTrigger value="delivery_man">Delivery Personnel</TabsTrigger>
            <TabsTrigger value="admin">Admins</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsAddUserOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="w-full sm:max-w-sm">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search users..."
                    className="pl-8 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </form>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="user">Customers</SelectItem>
                    <SelectItem value="restaurant_owner">Restaurant Owners</SelectItem>
                    <SelectItem value="delivery_man">Delivery Personnel</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <p>Loading users...</p>
              </div>
            ) : filteredUsers.length > 0 ? (
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead className="text-right w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getRoleColor(user.role)} text-white`}>
                          {getRoleName(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.orders}</TableCell>
                      <TableCell className="text-right w-32">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openViewDetails(user)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditUser(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedUser(user)
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
                <h3 className="text-lg font-medium mb-2">No users found</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("")
                    setRoleFilter("all")
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Admin</DialogTitle>
            <DialogDescription>
              Create a new admin account. They'll receive login instructions via email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddUser}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={newUser.address}
                  onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={newUser.confirmPassword}
                  onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Admin</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUserSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  value={editUser?.name || ""}
                  onChange={handleEditUserChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  name="email"
                  type="email"
                  value={editUser?.email || ""}
                  onChange={handleEditUserChange}
                  required
                />
              </div>

              {editUser?.role === "admin" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      name="phone"
                      type="tel"
                      value={editUser?.phone || ""}
                      onChange={handleEditUserChange}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-address">Address</Label>
                    <Input
                      id="edit-address"
                      name="address"
                      value={editUser?.address || ""}
                      onChange={handleEditUserChange}
                      required
                    />
                  </div>
                </>
              )}

              {editUser?.role === "restaurant_owner" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      name="phone"
                      type="tel"
                      value={editUser?.phone || ""}
                      onChange={handleEditUserChange}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-address">Address</Label>
                    <Input
                      id="edit-address"
                      name="address"
                      value={editUser?.address || ""}
                      onChange={handleEditUserChange}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-restaurantName">Restaurant Name</Label>
                    <Input
                      id="edit-restaurantName"
                      name="restaurantName"
                      value={editUser?.restaurantName || ""}
                      onChange={handleEditUserChange}
                      required
                    />
                  </div>
                </>
              )}

              {editUser?.role === "delivery_man" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      name="phone"
                      type="tel"
                      value={editUser?.phone || ""}
                      onChange={handleEditUserChange}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-address">Address</Label>
                    <Input
                      id="edit-address"
                      name="address"
                      value={editUser?.address || ""}
                      onChange={handleEditUserChange}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-vehicleNumber">Vehicle Number</Label>
                    <Input
                      id="edit-vehicleNumber"
                      name="vehicleNumber"
                      value={editUser?.vehicleNumber || ""}
                      onChange={handleEditUserChange}
                      required
                    />
                  </div>
                </>
              )}

              <div className="grid gap-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editUser?.role || ""}
                  onValueChange={(value) =>
                    setEditUser((prev) => prev ? { ...prev, role: value } : prev)
                  }
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">Customer</SelectItem>
                    <SelectItem value="restaurant_owner">Restaurant Owner</SelectItem>
                    <SelectItem value="delivery_man">Delivery Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedUser && (
              <div className="flex items-center gap-3 p-3 border rounded-md">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={selectedUser.avatar} alt={selectedUser.name} />
                  <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{selectedUser.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteUser}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog - NEW */}
      <Dialog open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Full information about the user.
            </DialogDescription>
          </DialogHeader>
          {viewUser && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 mb-2">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={viewUser.avatar} alt={viewUser.name} />
                  <AvatarFallback>{viewUser.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-lg">{viewUser.name}</div>
                  <div className="text-sm text-muted-foreground">{viewUser.email}</div>
                  <Badge className={`${getRoleColor(viewUser.role)} text-white mt-1`}>
                    {getRoleName(viewUser.role)}
                  </Badge>
                </div>
              </div>
              <dl className="divide-y divide-gray-100 border rounded-md bg-gray-50">
                <DetailRow label="id" value={viewUser.id} mono />
                {viewUser.phone && <DetailRow label="phone" value={viewUser.phone} />}
                {viewUser.address && <DetailRow label="address" value={viewUser.address} />}
                {viewUser.restaurantName && <DetailRow label="restaurantName" value={viewUser.restaurantName} />}
                {viewUser.vehicleNumber && <DetailRow label="vehicleNumber" value={viewUser.vehicleNumber} />}
                <DetailRow label="role" value={getRoleName(viewUser.role)} />
                {typeof viewUser.orders !== "undefined" && (
                  <DetailRow label="orders" value={viewUser.orders} />
                )}
              </dl>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsViewDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
   


