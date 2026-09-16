"use client";
import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SelectSingleEventHandler } from "react-day-picker";

// --- PDF dependencies ---
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
// ------------------------

interface Order {
  _id: string;
  order_id?: string;
  user_id: string;
  restaurant_id: string;
  items: {
    menu_item_id?: string;
    quantity: number;
    price: number;
    _id: string;
  }[];
  total_amount: number;
  status: string;
  delivery_fee: number;
  delivery_address: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  _id: string;
  name: string;
}

interface Restaurant {
  _id: string;
  name: string;
}

interface MenuItem {
  _id: string;
  name: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [restaurantMap, setRestaurantMap] = useState<Record<string, string>>({});
  const [menuItemMap, setMenuItemMap] = useState<Record<string, Record<string, string>>>({});

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        // Fetch all orders
        const ordersRes = await fetch("http://localhost:3008/api/orders");
        const ordersData: Order[] = await ordersRes.json();
        setOrders(ordersData);
        setFilteredOrders(ordersData);

        // Get unique user and restaurant IDs from orders
        const userIds = Array.from(new Set(ordersData.map(o => o.user_id)));
        const restaurantIds = Array.from(new Set(ordersData.map(o => o.restaurant_id)));

        // Fetch users by ID through JWT token
        const token = localStorage.getItem('jwt');
        const userMapTemp: Record<string, string> = {};
        await Promise.all(userIds.map(async (uid) => {
          const res = await fetch(`http://localhost:4000/api/auth/user/${uid}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          if (res.ok) {
            const user: User = await res.json();
            userMapTemp[uid] = user.name;
          }
        }));
        setUserMap(userMapTemp);

        // Fetch restaurants by ID
        const restaurantMapTemp: Record<string, string> = {};
        await Promise.all(restaurantIds.map(async (rid) => {
          const res = await fetch(`http://localhost:3001/api/restaurants/${rid}`);
          if (res.ok) {
            const restaurant: Restaurant = await res.json();
            restaurantMapTemp[rid] = restaurant.name;
          }
        }));
        setRestaurantMap(restaurantMapTemp);

        // Fetch menu items for each restaurant
        const menuItemMapTemp: Record<string, Record<string, string>> = {};
        await Promise.all(
          restaurantIds.map(async (rid) => {
            const res = await fetch(`http://localhost:3001/api/menu-items/restaurant/${rid}`);
            if (res.ok) {
              const menuItems: MenuItem[] = await res.json();
              menuItemMapTemp[rid] = {};
              menuItems.forEach(mi => {
                menuItemMapTemp[rid][mi._id] = mi.name;
              });
            }
          })
        );
        setMenuItemMap(menuItemMapTemp);

        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        setOrders([]);
        setFilteredOrders([]);
        setUserMap({});
        setRestaurantMap({});
        setMenuItemMap({});
      }
    };
    fetchAll();
  }, []);

  // Date filter function
  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  useEffect(() => {
    let filtered = [...orders];

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          ((order.order_id || order._id || "") as string).toLowerCase().includes(query) ||
          (order.user_id || "").toLowerCase().includes(query) ||
          (order.restaurant_id || "").toLowerCase().includes(query) ||
          (order.email || "").toLowerCase().includes(query) ||
          (order.phone || "").toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return isSameDay(orderDate, selectedDate);
      });
    }

    setFilteredOrders(filtered);
  }, [searchQuery, statusFilter, selectedDate, orders]);

  const handleDateSelect: SelectSingleEventHandler = (day) => {
    setSelectedDate(day);
  };

  const clearDateFilter = () => {
    setSelectedDate(undefined);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500";
      case "preparing": return "bg-blue-500";
      case "ready": return "bg-purple-500";
      case "out_for_delivery": return "bg-indigo-500";
      case "delivered": return "bg-green-500";
      case "cancelled": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // --- PDF GENERATION FUNCTION ---
  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "A4",
    });

    const columns = [
      { header: "Order ID", dataKey: "orderId" },
      { header: "Customer", dataKey: "customer" },
      { header: "Restaurant", dataKey: "restaurant" },
      { header: "Items", dataKey: "items" },
      { header: "Total", dataKey: "total" },
      { header: "Status", dataKey: "status" },
      { header: "Placed On", dataKey: "createdAt" },
      { header: "Phone", dataKey: "phone" },
      { header: "Email", dataKey: "email" },
      { header: "Delivery Address", dataKey: "deliveryAddress" },
    ];

    const rows = filteredOrders.map((order) => ({
      orderId: order.order_id || order._id,
      customer: userMap[order.user_id] || order.user_id,
      restaurant: restaurantMap[order.restaurant_id] || order.restaurant_id,
      items: order.items
        .map(
          (item) =>
            `${
              menuItemMap[order.restaurant_id]?.[item.menu_item_id || item._id] ||
              "Unknown Item"
            } x${item.quantity} (${formatCurrency(item.price)})`
        )
        .join(", "),
      total: formatCurrency(order.total_amount),
      status: order.status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      createdAt: format(new Date(order.createdAt), "yyyy-MM-dd HH:mm"),
      phone: order.phone,
      email: order.email,
      deliveryAddress: order.delivery_address,
    }));

    doc.setFontSize(18);
    doc.text("All Orders Report", 40, 40);

    autoTable(doc, {
      startY: 60,
      head: [columns.map((col) => col.header)],
      body: rows.map((row) => columns.map((col) => row[col.dataKey as keyof typeof row])),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 240, 255] },
      margin: { left: 40, right: 40 },
      tableWidth: "auto",
      didDrawPage: (data: { settings: { margin: { left: number; }; }; }) => {
        doc.setFontSize(10);
        doc.text(
          `Generated: ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
          data.settings.margin.left,
          doc.internal.pageSize.getHeight() - 10
        );
      },
    });

    doc.save("orders_report.pdf");
  };
  // --- END PDF GENERATION FUNCTION ---

  // Modal component
  const OrderDetailsModal = ({
    order,
    onClose,
  }: {
    order: Order;
    onClose: () => void;
  }) => {
    if (!order) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        aria-modal="true"
        role="dialog"
        aria-labelledby="order-details-title"
        aria-describedby="order-details-content"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-8 relative animate-fadeIn">
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-2xl"
            onClick={onClose}
            aria-label="Close details modal"
          >
            ×
          </button>
          <h2
            id="order-details-title"
            className="text-3xl font-bold text-blue-800 mb-2 tracking-tight"
          >
            Order Details
          </h2>
          <p className="text-gray-500 mb-6">
            Placed on {format(new Date(order.createdAt), "yyyy-MM-dd HH:mm")}
          </p>
          <div id="order-details-content" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs text-gray-400">Order ID</span>
                <span className="font-semibold">{order.order_id || order._id}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400">Status</span>
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-bold shadow-sm ${getStatusColor(
                    order.status
                  )} text-white`}
                >
                  {order.status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
                </span>
              </div>
              <div>
                <span className="block text-xs text-gray-400">Customer</span>
                <span className="font-medium">{userMap[order.user_id] || order.user_id}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400">Restaurant</span>
                <span className="font-medium">{restaurantMap[order.restaurant_id] || order.restaurant_id}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400">Phone</span>
                <span>{order.phone}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400">Email</span>
                <span>{order.email}</span>
              </div>
              <div className="col-span-2">
                <span className="block text-xs text-gray-400">Delivery Address</span>
                <span>{order.delivery_address}</span>
              </div>
            </div>
            {/* Items */}
            <div>
              <span className="block text-xs text-gray-400 mb-2">Items</span>
              <ul>
              {order.items.map((item) => (
              <li key={item._id}>
                 {menuItemMap[order.restaurant_id]?.[item.menu_item_id || item._id] || "Item"}
                 <span className="text-xs text-gray-400 ml-2">(ID: {item.menu_item_id || item._id}) x{item.quantity}</span>
                 <span className="font-mono ml-4 flex-shrink-0 ">{formatCurrency(item.price)}</span>
              </li>
               ))}
              </ul>
          </div>

            {/* Summary */}
            <div className="flex flex-col gap-2 border-t pt-4 mt-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatCurrency(order.total_amount - order.delivery_fee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Fee</span>
                <span>{formatCurrency(order.delivery_fee)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-blue-800">
                <span>Total</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-1 tracking-tight">Order Management</h1>
        <p className="text-gray-500 text-lg">Track and manage all orders </p>
      </div>
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 w-full">
          <input
            type="text"
            placeholder="Search by Order ID, User ID, Restaurant ID, Email, Phone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-96 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />

          <div className="relative w-full md:w-60">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full border border-gray-300 rounded-lg px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "yyyy-MM-dd") : <span>Filter by date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-60 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {selectedDate && (
            <button
              onClick={clearDateFilter}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 font-medium transition md:w-auto"
            >
              Clear Date Filter
            </button>
          )}
        </div>
      </div>

      {/* Download PDF Button */}
      <Button
        onClick={handleDownloadPDF}
        className="mb-6 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow transition"
      >
        Download PDF Report
      </Button>

      {/* Filter Status Display */}
      {selectedDate && (
        <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg inline-flex items-center">
          <span className="text-blue-700 font-medium">
            Showing orders from: {selectedDate.toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl shadow-lg bg-white">
        <table className="min-w-full table-auto text-left">
          <thead>
            <tr className="bg-gradient-to-r from-blue-100 to-gray-100">
              <th className="px-4 py-3 font-semibold text-gray-700">Order ID</th>
              <th className="px-4 py-3 font-semibold text-gray-700">User ID / Name</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Restaurant ID / Name</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Items</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Total</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  Loading orders...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  No orders found.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order, idx) => (
                <tr
                  key={order._id}
                  className={
                    idx % 2 === 0
                      ? "bg-white hover:bg-blue-50 transition"
                      : "bg-gray-50 hover:bg-blue-100 transition"
                  }
                >
                  <td className="px-4 py-3 font-mono text-sm">{order.order_id || order._id}</td>
                  <td className="px-4 py-3 text-sm">
                    {order.user_id}
                    {userMap[order.user_id] ? ` / ${userMap[order.user_id]}` : ""}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {order.restaurant_id}
                    {restaurantMap[order.restaurant_id] ? ` / ${restaurantMap[order.restaurant_id]}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs">
  <ul>
    {order.items.map((item) => (
      <li key={item._id}>
        {menuItemMap[order.restaurant_id]?.[item.menu_item_id || item._id] || "Item"}
        <span className="text-xs text-gray-400 ml-2">
          ({item.menu_item_id || item._id}) x{item.quantity}
        </span>
        {/* <span className="font-mono ml-2">{formatCurrency(item.price)}</span> */}
      </li>
    ))}
  </ul>
</td>



                  <td className="px-4 py-3 font-semibold text-blue-700">{formatCurrency(order.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowModal(true);
                      }}
                    >
                      View Details
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Modal */}
      {showModal && selectedOrder && (
        <OrderDetailsModal order={selectedOrder} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
