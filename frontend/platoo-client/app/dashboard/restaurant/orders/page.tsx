"use client";

import { useEffect, useState, useRef, JSX } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChefHat,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  MoreVertical,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Order {
  id: string;
  user_id: string; // <-- Add this field for customer lookup
  customer: {
    name: string;
    address: string;
  };
  items: { name: string; quantity: number; price: string; menu_item_id?: string }[];
  total: string;
  status: string;
  time: string;
  payment: string;
  delivery: string;
  restaurant_id: string;
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [customerNames, setCustomerNames] = useState<{ [key: string]: string }>({}); // uid -> name

  useEffect(() => {
    const ownerId = localStorage.getItem("restaurantOwnerId");
    if (!ownerId) return;

    const fetchRestaurants = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:3001/api/restaurants/owner/${ownerId}`);
        if (!response.ok) throw new Error("Failed to fetch restaurants");
        const data = await response.json();
        if (data.length > 0) {
          setRestaurantId(data[0]._id);
        } else {
          setError("No restaurants found for this owner");
        }
      } catch (error) {
        console.error("Error fetching restaurants:", error);
        setError("Failed to fetch restaurants");
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (!restaurantId) return;

    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("http://localhost:3008/api/orders");
        if (!res.ok) throw new Error("Failed to fetch orders");
        const data = await res.json();
        const mappedOrders: Order[] = data
          .filter((order: any) => order.restaurant_id === restaurantId)
          .map((order: any) => ({
            id: order.order_id,
            user_id: order.user_id, // <-- Ensure this field is present in your order data
            customer: {
              name: "", // will be filled after fetching customer name
              address: order.delivery_address || "N/A",
            },
            items: order.items.map((item: any) => ({
              name: item.name || item.menu_item_id || "Item",
              quantity: item.quantity,
              price: item.price.toFixed(2),
              menu_item_id: item.menu_item_id,
            })),
            total: order.total_amount.toFixed(2),
            status: order.status,
            time: new Date(order.createdAt).toLocaleString(),
            payment: "Online",
            delivery: "Delivery",
            restaurant_id: order.restaurant_id,
            createdAt: order.createdAt,
          }));
        setOrders(mappedOrders);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [restaurantId]);

  // Fetch customer names for each unique user_id in orders
  useEffect(() => {
    const fetchCustomerNames = async () => {
      const token = localStorage.getItem("jwtToken");
      if (!token || orders.length === 0) return;

      const uniqueUserIds = Array.from(new Set(orders.map(order => order.user_id).filter(Boolean)));
      const nameMap: { [key: string]: string } = {};

      await Promise.all(
        uniqueUserIds.map(async (uid) => {
          try {
            const res = await fetch(`http://localhost:4000/api/auth/user/${uid}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (!res.ok) throw new Error("Failed to fetch user");
            const userData = await res.json();
            nameMap[uid] = userData.name || "Customer";
          } catch {
            nameMap[uid] = "Customer";
          }
        })
      );
      setCustomerNames(nameMap);
    };

    fetchCustomerNames();
  }, [orders]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const filteredOrders = orders.filter((order) => {
    if (selectedTab !== "all" && order.status !== selectedTab) return false;
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      const matchesQuery =
        order.id.toLowerCase().includes(query) ||
        (customerNames[order.user_id]?.toLowerCase() || "").includes(query) ||
        order.total.toLowerCase().includes(query);
      if (!matchesQuery) return false;
    }
    if (selectedRange?.from && selectedRange?.to) {
      const orderDate = new Date(order.createdAt);
      const start = new Date(selectedRange.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedRange.to);
      end.setHours(23, 59, 59, 999);
      if (orderDate < start || orderDate > end) return false;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const commonProps = "mr-1 h-3 w-3";
    const badgeMap: Record<string, JSX.Element> = {
      preparing: (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
          <ChefHat className={commonProps} /> Preparing
        </Badge>
      ),
      ready: (
        <Badge variant="outline" className="bg-green-100 text-green-800">
          <CheckCircle className={commonProps} /> Ready
        </Badge>
      ),
      delivered: (
        <Badge variant="outline" className="bg-blue-100 text-blue-800">
          <CheckCircle className={commonProps} /> Delivered
        </Badge>
      ),
      cancelled: (
        <Badge variant="outline" className="bg-red-100 text-red-800">
          <XCircle className={commonProps} /> Cancelled
        </Badge>
      ),
    };
    return badgeMap[status] || (
      <Badge variant="outline">
        <Clock className={commonProps} /> {status}
      </Badge>
    );
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setSelectedStatus(order.status);
    setIsDetailsOpen(true);
    setOpenDropdownId(null);
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`http://localhost:3008/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setOrders((prevOrders) =>
        prevOrders.map((o) =>
          o.id === orderId ? { ...o, status: newStatus } : o
        )
      );
    } catch (err) {
      console.error("Error updating status", err);
    }
  };

  const handleSentDelivery = async (order: Order) => {
    try {
      const statusRes = await fetch(
        `http://localhost:3008/api/orders/${order.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ready" }),
        }
      );
      if (!statusRes.ok) throw new Error("Failed to update order status");
      const usersRes = await fetch("http://localhost:4000/api/auth/users");
      if (!usersRes.ok) throw new Error("Failed to fetch users");
      const users = await usersRes.json();

      const deliveryPersons = users.filter(
        (user: { role: string; }) => user.role?.toLowerCase() === "delivery_man"
      );
      if (deliveryPersons.length === 0) {
        throw new Error("No delivery persons available");
      }

      const orderDetails = {
        id: order.id,
        customer: {
          name: customerNames[order.user_id] || "Customer",
          address: order.customer.address,
        },
        total: parseFloat(order.total),
      };

      const emailRes = await fetch(
        "http://localhost:4006/api/notifications/send-delivery-notification",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderDetails }),
        }
      );
      const result = await emailRes.json();

      if (!emailRes.ok) {
        throw new Error(result.message || "Email sending failed");
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "ready" } : o))
      );

      alert(result.success
        ? "Order sent to all delivery persons!"
        : "Partial success: " + result.message
      );

    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to send notifications");
    }
  };

  const handleMarkDelivered = async (order: Order) => {
    try {
      const res = await fetch(
        `http://localhost:3008/api/orders/${order.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "delivered" }),
        }
      );
      if (!res.ok) throw new Error("Failed to update order status");
      setOrders((prevOrders) =>
        prevOrders.map((o) =>
          o.id === order.id ? { ...o, status: "delivered" } : o
        )
      );
    } catch (err) {
      console.error(err);
      alert("Could not mark order as delivered.");
    }
  };

  const handleSaveChanges = () => {
    if (selectedOrder && selectedStatus) {
      handleUpdateStatus(selectedOrder.id, selectedStatus);
      setIsDetailsOpen(false);
    }
  };

  // ----------- PDF EXPORT FUNCTION -----------
  const handleDownloadPDF = () => {
    const statusGroups = {
      pending: filteredOrders.filter(order => order.status === "pending"),
      preparing: filteredOrders.filter(order => order.status === "preparing"),
      ready: filteredOrders.filter(order => order.status === "ready"),
      delivered: filteredOrders.filter(order => order.status === "delivered"),
      cancelled: filteredOrders.filter(order => order.status === "cancelled"),
    };

    const columns = [
      { header: "Order ID", dataKey: "id" as const },
      { header: "Customer", dataKey: "customer" as const },
      { header: "Menu Items", dataKey: "menuitems" as const },
      { header: "Total", dataKey: "total" as const },
      { header: "Time", dataKey: "time" as const },
      { header: "Address", dataKey: "address" as const }
    ];

    type Row = {
      id: string;
      customer: string;
      menuitems: string;
      total: string;
      time: string;
      address: string;
    };

    const formatOrder = (order: Order): Row => ({
      id: order.id,
      customer: customerNames[order.user_id] || "Customer",
      menuitems: order.items
        .map((item: any) => item.menu_item_id || item.name || "N/A")
        .join(", "),
      total: order.total,
      time: order.time,
      address: order.customer.address
    });

    const doc = new jsPDF();
    let startY = 15;

    Object.entries(statusGroups).forEach(([status, orders]) => {
      if (orders.length > 0) {
        doc.setFontSize(14);
        doc.text(`${status.toUpperCase()} ORDERS (${orders.length})`, 14, startY);
        startY += 8;

        autoTable(doc, {
          startY,
          head: [columns.map(col => col.header)],
          body: orders.map(order => columns.map(col => formatOrder(order)[col.dataKey])),
          styles: { fontSize: 10 },
          margin: { horizontal: 14 }
        });

        startY = (doc as any).lastAutoTable.finalY + 15;
      }
    });

    doc.save("orders-report.pdf");
  };
  // ----------- END PDF EXPORT FUNCTION -----------

  if (loading) return <div className="p-6 text-center">Loading orders...</div>;
  if (error) return <div className="p-6 text-center text-red-600">Error: {error}</div>;

  const tabs = ["all", "pending", "preparing", "ready", "delivered"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage and track all your restaurant orders
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadPDF}>Generate PDF</Button>
        </div>
      </div>

      <Tabs
        defaultValue="all"
        className="space-y-4"
        onValueChange={setSelectedTab}
      >
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <TabsList>
            {tabs.map((status) => (
              <TabsTrigger key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[220px] justify-start text-left font-normal",
                    !selectedRange?.from && !selectedRange?.to && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedRange?.from && selectedRange?.to
                    ? `${format(selectedRange.from, "yyyy-MM-dd")} ~ ${format(selectedRange.to, "yyyy-MM-dd")}`
                    : <span>Pick date range</span>
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={selectedRange}
                  onSelect={setSelectedRange}
                  initialFocus
                />
                <div className="flex justify-end p-2">
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedRange(undefined)}
                    disabled={!selectedRange?.from && !selectedRange?.to}
                  >
                    Clear Range
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search orders..."
                className="pl-8 w-[300px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <TabsContent value={selectedTab} className="space-y-4">
          <Card>
            <CardHeader className="p-4">
              <CardTitle>Order List</CardTitle>
              <CardDescription>
                {filteredOrders.length} orders found
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    {(selectedTab === "all" ||
                      selectedTab === "pending" ||
                      selectedTab === "preparing") && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.id}</TableCell>
                      <TableCell>
                        {customerNames[order.user_id] || "Loading..."}
                      </TableCell>
                      <TableCell>{order.total}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{order.time}</TableCell>
                      <TableCell>{order.payment}</TableCell>
                      {selectedTab === "all" && (
                        <TableCell className="text-right" style={{ position: "relative" }}>
                          {order.status === "delivered" ? (
                            <CheckCircle className="text-blue-500 mx-auto" size={20} />
                          ) : order.status === "ready" ? (
                            <ChefHat className="text-green-500 mx-auto" size={20} />
                          ) : (
                            <>
                              <button
                                className="p-2 rounded-full hover:bg-gray-100"
                                onClick={() =>
                                  setOpenDropdownId(
                                    openDropdownId === order.id ? null : order.id
                                  )
                                }
                                aria-label="More"
                              >
                                <MoreVertical size={20} />
                              </button>
                              {openDropdownId === order.id && (
                                <div
                                  ref={(el) => {
                                    dropdownRefs.current[order.id] = el;
                                  }}
                                  className="absolute right-0 z-10 mt-2 w-32 bg-white border border-gray-200 rounded shadow-lg"
                                >
                                  <button
                                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                                    onClick={() => handleViewDetails(order)}
                                  >
                                    View details
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </TableCell>
                      )}
                      {selectedTab === "pending" && (
                        <TableCell className="text-right" style={{ position: "relative" }}>
                          <button
                            className="p-2 rounded-full hover:bg-gray-100"
                            onClick={() =>
                              setOpenDropdownId(
                                openDropdownId === order.id ? null : order.id
                              )
                            }
                            aria-label="More"
                          >
                            <MoreVertical size={20} />
                          </button>
                          {openDropdownId === order.id && (
                            <div
                              ref={(el) => {
                                dropdownRefs.current[order.id] = el;
                              }}
                              className="absolute right-0 z-10 mt-2 w-32 bg-white border border-gray-200 rounded shadow-lg"
                            >
                              <button
                                className="w-full text-left px-4 py-2 hover:bg-gray-100"
                                onClick={() => handleViewDetails(order)}
                              >
                                View details
                              </button>
                            </div>
                          )}
                        </TableCell>
                      )}
                      {selectedTab === "preparing" && (
                        <TableCell className="text-right">
                          <Button onClick={() => handleSentDelivery(order)}>
                            Sent to Delivery
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              View and update the status of the order.
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <span className="font-medium">Customer: </span>
                {customerNames[selectedOrder.user_id] || "Loading..."}
              </div>
              <div>
                <span className="font-medium">Address: </span>
                {selectedOrder.customer.address}
              </div>
              <div className="space-y-2">
                <span className="font-medium">Items:</span>
                <ul className="space-y-1">
                  {selectedOrder.items.map((item, index) => (
                    <li key={index}>
                      {item.quantity} x {item.name} - {item.price}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Total:</span>
                <span>{selectedOrder.total}</span>
              </div>
              <div>
                <span className="font-medium">Payment Type:</span>{" "}
                {selectedOrder.payment}
              </div>
              <div>
                <span className="font-medium">Delivery Method:</span>{" "}
                {selectedOrder.delivery}
              </div>
              <div>
                <span className="font-medium">Status: </span>
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                  disabled={selectedOrder.status === "delivered"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedOrder?.status === "preparing"
                      ? ["ready"]
                      : selectedOrder?.status === "ready"
                      ? ["delivered"]
                      : selectedOrder?.status === "pending"
                      ? ["preparing"]
                      : ["pending", "preparing", "ready", "delivered"]
                    ).map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDetailsOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={selectedOrder?.status === "delivered"}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
