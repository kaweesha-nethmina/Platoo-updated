"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Receipt, ExternalLink, Download, Star } from "lucide-react";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Interface definitions for order and order items
interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  menu_item_id: string;
}

interface Order {
  id: string;
  date: string;
  status: "pending" | "preparing" | "On the way" | "delivered" | "cancelled" | "ready";
  items: OrderItem[];
  address: string;
  deliveryTime: string;
  total: number;
  restaurantName: string;
  restaurantImage: string;
  restaurantRating: number;
  restaurantId: string;
}

interface Restaurant {
  id: string;
  name: string;
  image: string;
  rating: number;
}

interface MenuItem {
  _id: string;
  name: string;
  price: number;
}

export default function OrderHistoryPage() {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState(false); // State to control modal visibility
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null); // To hold the selected order

  const loggedInUserId = localStorage.getItem("userId"); // Retrieve the logged-in user's ID

  useEffect(() => {
    if (!loggedInUserId) {
      setIsLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        const response = await fetch(`http://localhost:3008/api/orders/history/${loggedInUserId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch orders");
        }
        const orders = await response.json();

        // Fetch all restaurant data
        const restaurantResponse = await fetch("http://localhost:3001/api/restaurants");
        if (!restaurantResponse.ok) {
          throw new Error("Failed to fetch restaurants");
        }
        const restaurants = await restaurantResponse.json();

        // Fetch menu items for each restaurant
        const fetchMenuItems = async (restaurantId: string) => {
          const menuResponse = await fetch(`http://localhost:3001/api/menu-items/restaurant/${restaurantId}`);
          if (!menuResponse.ok) {
            throw new Error("Failed to fetch menu items");
          }
          return await menuResponse.json();
        };

        // Map the fetched orders to match the expected format and fetch restaurant info and menu items
        const mappedOrders: Order[] = await Promise.all(orders.map(async (order: any) => {
          const restaurant = restaurants.find((r: any) => r._id === order.restaurant_id);
          const menuItems = await fetchMenuItems(order.restaurant_id);

          // Map menu items to order items
          const itemsWithNames = order.items.map((item: any) => {
            const menuItem = menuItems.find((menu: MenuItem) => menu._id === item.menu_item_id);
            return {
              ...item,
              name: menuItem ? menuItem.name : "Unknown Item", // Fallback if item is not found
            };
          });

          return {
            id: order.order_id,
            date: new Date(order.createdAt).toLocaleString(),
            status: order.status,
            items: itemsWithNames,
            address: order.delivery_address,
            deliveryTime: "TBD", // Placeholder for delivery time
            total: order.total_amount,
            restaurantName: restaurant ? restaurant.name : "Unknown",
            restaurantImage: restaurant ? restaurant.image : "/placeholder.svg", // Fallback image
            restaurantRating: restaurant ? restaurant.rating : 0, // Fallback rating
            restaurantId: order.restaurant_id, // Store the restaurant ID
          };
        }));

        setAllOrders(mappedOrders);
        setFilteredOrders(mappedOrders); // Initially set to all orders
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [loggedInUserId]);

  const filterOrdersByStatus = (status: string) => {
    if (status === "all") {
      setFilteredOrders(allOrders);
    } else {
      setFilteredOrders(allOrders.filter((order) => order.status.toLowerCase() === status.toLowerCase()));
    }
  };

  const generatePDF = (order: Order) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header: Site Name
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("PLATOO", pageWidth / 2, 22, { align: "center" });

    // Subheader: Receipt
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Receipt", pageWidth / 2, 32, { align: "center" });

    // Draw a line under the title
    doc.setLineWidth(0.5);
    doc.line(15, 36, pageWidth - 15, 36);

    // Order Details
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    let y = 44;
    const detailGap = 8;

    doc.text(`Order ID:`, 18, y);
    doc.text(order.id, 50, y);
    y += detailGap;
    doc.text(`Restaurant:`, 18, y);
    doc.text(order.restaurantName, 50, y);
    y += detailGap;
    doc.text(`Status:`, 18, y);
    doc.text(order.status, 50, y);
    y += detailGap;
    doc.text(`Date:`, 18, y);
    doc.text(order.date, 50, y);
    y += detailGap;
    doc.text(`Total Amount:`, 18, y);
    doc.text(`LKR ${order.total.toFixed(2)}`, 50, y);
    y += detailGap;
    doc.text(`Delivery Address:`, 18, y);
    // Wrap address if too long
    const addressLines = doc.splitTextToSize(order.address, pageWidth - 60);
    doc.text(addressLines, 50, y);
    y += detailGap * addressLines.length + 4;

    // Items Table
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Items", 18, y);
    y += 4;

    autoTable(doc, {
      startY: y + 4,
      head: [["#", "Item", "Qty", "Price (LKR)"]],
      body: order.items.map((item, idx) => [
        idx + 1,
        item.name,
        item.quantity,
        item.price.toFixed(2),
      ]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 12 },
      headStyles: { fillColor: [0, 0, 0], textColor: 255, halign: "center" },
      bodyStyles: { halign: "center" },
      columnStyles: {
        1: { halign: "left" },
      },
      margin: { left: 18, right: 18 },
    });

    // Calculate new Y after table
    const finalY = (doc as any).lastAutoTable.finalY;

    // Total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0); // Set text color to black
    doc.text(
      `Total: LKR ${order.total.toFixed(2)}`,
      pageWidth - 20,
      finalY + 17,
      { align: "right" }
    );

    // Footer
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(
      "Thank you for your order!",
      pageWidth / 2,
      finalY + 30,
      { align: "center" }
    );

    // Border
    doc.setLineWidth(0.5);
    doc.rect(12, 12, pageWidth - 24, finalY + 35 - 12);

    doc.save(`${order.id}_receipt.pdf`);
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order); // Set the selected order
    setShowModal(true); // Show the modal
  };

  const closeModal = () => {
    setShowModal(false); // Close the modal
  };

  if (isLoading) {
    return (
      <div>
        <Header cartCount={1} />
        <div className="flex justify-center items-center h-[50vh]">
          <p className="text-gray-500">Loading orders...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Header cartCount={1} />
      <div className="container py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Order History</h1>
            <p className="text-gray-500">View and manage your past orders</p>
          </div>

          <Tabs defaultValue="all" onValueChange={filterOrdersByStatus}>
            <TabsList>
              <TabsTrigger value="all">All Orders</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="preparing">Preparing</TabsTrigger>
              <TabsTrigger value="ready">On the way</TabsTrigger>
              <TabsTrigger value="delivered">Delivered</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>

            {/* Tab Content for All Orders */}
            <TabsContent value="all" className="space-y-4">
              {filteredOrders.map((order) => (
                <OrderCard key={order.id} order={order} generatePDF={generatePDF} handleViewDetails={handleViewDetails} />
              ))}
            </TabsContent>

            {/* Tab Content for Pending Orders */}
            <TabsContent value="pending" className="space-y-4">
              {filteredOrders.filter((order) => order.status === "pending").map((order) => (
                <OrderCard key={order.id} order={order} generatePDF={generatePDF} handleViewDetails={handleViewDetails} />
              ))}
            </TabsContent>

            {/* Tab Content for Preparing Orders */}
            <TabsContent value="preparing" className="space-y-4">
              {filteredOrders.filter((order) => order.status === "preparing").map((order) => (
                <OrderCard key={order.id} order={order} generatePDF={generatePDF} handleViewDetails={handleViewDetails} />
              ))}
            </TabsContent>

            {/* Tab Content for Ready Orders */}
            <TabsContent value="ready" className="space-y-4">
              {filteredOrders.filter((order) => order.status === "ready").map((order) => (
                <OrderCard key={order.id} order={order} generatePDF={generatePDF} handleViewDetails={handleViewDetails} />
              ))}
            </TabsContent>

            {/* Tab Content for Delivered Orders */}
            <TabsContent value="delivered" className="space-y-4">
              {filteredOrders.filter((order) => order.status === "delivered").map((order) => (
                <OrderCard key={order.id} order={order} generatePDF={generatePDF} handleViewDetails={handleViewDetails} />
              ))}
            </TabsContent>

            {/* Tab Content for Cancelled Orders */}
            <TabsContent value="cancelled" className="space-y-4">
              {filteredOrders.filter((order) => order.status === "cancelled").map((order) => (
                <OrderCard key={order.id} order={order} generatePDF={generatePDF} handleViewDetails={handleViewDetails} />
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modal to show details */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-md w-1/2">
            <h2 className="text-2xl font-semibold">Order Details</h2>
            <div className="mt-4">
              <p><strong>Order ID:</strong> {selectedOrder.id}</p>
              <p><strong>Restaurant:</strong> {selectedOrder.restaurantName}</p>
              <p><strong>Status:</strong> {selectedOrder.status}</p>
              <p><strong>Date:</strong> {selectedOrder.date}</p>
              <p><strong>Total:</strong> LKR {selectedOrder.total.toFixed(2)}</p>
              <p><strong>Delivery Address:</strong> {selectedOrder.address}</p>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={closeModal}>Close</Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

function OrderCard({ order, generatePDF, handleViewDetails }: { order: Order, generatePDF: (order: Order) => void, handleViewDetails: (order: Order) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">Order #{order.id}</CardTitle>
            <p className="text-sm text-gray-500">{order.date}</p>
          </div>
          <Badge
            className={
              order.status === "delivered"
                ? "bg-green-500"
                : order.status === "cancelled"
                ? "bg-red-500"
                : order.status === "pending"
                ? "bg-yellow-500"
                : "bg-orange-500"
            }
          >
            {order.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
              <Image
                src={order.restaurantImage || "/placeholder.svg"}
                alt={order.restaurantName}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="font-medium">{order.restaurantName}</h3>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Star className="h-3 w-3 fill-orange-500 text-orange-500" />
                <span>{order.restaurantRating}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <Receipt className="h-4 w-4 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium">Order Items</p>
                <ul className="text-sm text-gray-500">
                  {order.items.map((item, index) => (
                    <li key={index}>
                      {item.quantity}x {item.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium">Delivery Address</p>
                <p className="text-sm text-gray-500">{order.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium">Delivery Time</p>
                <p className="text-sm text-gray-500">{order.deliveryTime}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <p className="font-semibold">Total: LKR {order.total.toFixed(2)}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => generatePDF(order)}>
                <Download className="mr-2 h-4 w-4" />
                Generate PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleViewDetails(order)}>
                View Details
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
