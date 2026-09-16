"use client";

import { useCart } from "@/hooks/useCart";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Check, Clock, MapPin, ArrowRight } from "lucide-react";
import jsPDF from "jspdf";

export default function OrderConfirmationPage() {
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [deliveryTime, setDeliveryTime] = useState<string>("");
  const [menuItemsMap, setMenuItemsMap] = useState<Record<string, string>>({});
  // Use the useCart hook to get cart items and cart count
  const { cartItems } = useCart(); // You can access cartItems, subtotal, etc.
  const cartCount = cartItems.length; // Get the count of items in the cart

  const clearLocalStorage = () => {
    localStorage.removeItem("order_id");
    localStorage.removeItem("selectedItem");
    localStorage.removeItem("selectedQuantity");
    localStorage.removeItem("restaurantId");
    localStorage.removeItem("selectedAddress");
    localStorage.removeItem("userPhone");
    console.log("Order data cleared from localStorage.");
  };

  useEffect(() => {
    const orderId = localStorage.getItem("order_id");
    if (orderId) {
      fetchOrderDetails(orderId);
    }

    const restaurantId = localStorage.getItem("restaurantId");
    if (restaurantId) {
      fetchRestaurantName(restaurantId);
    }

    return () => {
      clearLocalStorage();
    };
  }, []);

  useEffect(() => {
    if (orderDetails?.items?.length) {
      fetchMenuItemNames(orderDetails.items.map((item: any) => item.menu_item_id));
    }
  }, [orderDetails]);

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const res = await fetch(`http://localhost:3008/api/orders/${orderId}`);
      const data = await res.json();
      setOrderDetails(data);
    } catch (error) {
      console.error("Error fetching order:", error);
    }
  };

  const fetchRestaurantName = async (restaurantId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/restaurants/${restaurantId}`);
      const data = await res.json();
      setRestaurantName(data.name);
      setDeliveryTime(data.deliveryTime);
    } catch (error) {
      console.error("Error fetching restaurant:", error);
    }
  };

  const fetchMenuItemNames = async (menuItemIds: string[]) => {
    try {
      const res = await fetch(`http://localhost:3001/api/menu-items`);
      const data = await res.json();
      const map: Record<string, string> = {};
      data.forEach((item: any) => {
        map[item._id] = item.name;
      });
      setMenuItemsMap(map);
    } catch (error) {
      console.error("Error fetching menu items:", error);
    }
  };

  if (!orderDetails) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header cartCount={0} />
        <main className="max-w-[1400px] mx-auto px-6 py-8">
          <h2>Loading order details...</h2>
        </main>
        <Footer />
      </div>
    );
  }

  const { total_amount, delivery_fee, items, delivery_address, phone } = orderDetails;

  const handleOrderMoreFood = () => {
    clearLocalStorage();
    router.push("/restaurants");
  };

  const handleGoToDashboard = () => {
    clearLocalStorage();
    router.push("/dashboard");
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "normal").setFontSize(12);
    doc.setFontSize(18).setTextColor(0, 0, 0).text("PLATOO", 14, 20);
    doc.setFontSize(12).text("Your Order Invoice", 14, 30);

    doc.text(`Order ID: ${orderDetails?.order_id}`, 14, 40);
    doc.text(`Restaurant: ${restaurantName}`, 14, 50);
    doc.text(`Delivery Address: ${delivery_address}`, 14, 60);
    doc.text(`Phone: ${phone}`, 14, 70);
    doc.text(`Estimated Delivery Time: ${deliveryTime}`, 14, 80);
    doc.setLineWidth(0.5).line(14, 85, 200, 85);

    doc.setFontSize(14).text("Order Summary", 14, 95);

    let yOffset = 105;
    let subtotal = 0;

    items?.forEach((item: any) => {
      const itemName = menuItemsMap[item.menu_item_id] || "Item";
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      doc.setFontSize(12).text(`${item.quantity}x ${itemName}`, 14, yOffset);
      doc.text(`LKR ${itemTotal.toFixed(2)}`, 120, yOffset, { align: "right" }); // Change currency to LKR
      yOffset += 10;
    });

    doc.line(14, yOffset, 200, yOffset);
    yOffset += 10;

    doc.text(`Subtotal: LKR ${subtotal.toFixed(2)}`, 14, yOffset); // Change currency to LKR
    yOffset += 6;
    doc.text(`Delivery Fee: LKR ${delivery_fee.toFixed(2)}`, 14, yOffset); // Change currency to LKR
    yOffset += 6;

    const totalAmount = subtotal + delivery_fee;
    doc.setFontSize(14).text(`Total: LKR ${totalAmount.toFixed(2)}`, 14, yOffset); // Change currency to LKR
    yOffset += 10;

    doc.setFontSize(10);
    doc.text("Thank you for your order!", 14, yOffset + 10);
    doc.text("For inquiries, contact support at platoo@gmail.com", 14, yOffset + 16);
    doc.save(`Order_${orderDetails?.order_id}.pdf`);
};


  return (
    <div className="min-h-screen bg-gray-50">
      <Header cartCount={cartCount} />
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
            <p className="text-gray-500">
              Your order has been placed successfully. We'll notify you once it's on the way.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Order #{orderDetails.order_id}</CardTitle>
              <CardDescription>Thank you for your order from {restaurantName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start space-x-3">
                <Clock className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Estimated Delivery Time</h3>
                  <p className="text-gray-500">{deliveryTime}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Delivery Address</h3>
                  <p className="text-gray-500">{delivery_address}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Phone</h3>
                  <p className="text-gray-500">{phone}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="font-medium">Order Summary</h3>
                </div>
                <div className="p-4">
                  <div className="space-y-3 mb-4">
                    {items?.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between">
                        <div>
                          <span className="font-medium">{item.quantity}x</span>{" "}
                          {menuItemsMap[item.menu_item_id] || "Loading..."}
                        </div>
                        <div>LKR {(item.price * item.quantity).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>LKR {total_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Delivery Fee</span>
                      <span>LKR {delivery_fee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-2 border-t">
                      <span>Total</span>
                      <span>LKR {(total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <Button variant="outline" className="flex-1" onClick={handleOrderMoreFood}>
                  Order More Food
                </Button>
                <Button className="flex-1 bg-red-500 hover:bg-red-600" onClick={handleGoToDashboard}>
                  Go to Dashboard
                </Button>
                <Button className="flex-1 bg-blue-500 hover:bg-blue-600" onClick={generatePDF}>
                  Download Invoice
                </Button>
              </div>
            </CardFooter>
          </Card>

          <div className="mt-8 text-center">
            <p className="text-gray-500 mb-4">Have questions about your order?</p>
            <Button variant="link" className="text-red-500">
              Contact Support <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
