"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type CartItemType = {
  id: string;
  menuItemId: string; // used consistently with RestaurantPage
  name: string;
  price: number;
  quantity: number;
  image?: string;
};

type CartAPIResponse = {
  _id: string;
  userId: string;
  items: {
    image: string;
    _id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
};

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItemType[]>([]);

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const storedUserId = localStorage.getItem("userId");
        if (!storedUserId) {
          console.warn("No userId in localStorage");
          return;
        }
  
        const response = await axios.get<CartAPIResponse>(
          `http://localhost:3005/api/cart/${storedUserId}`
        );
  
        const items = response.data.items.map((item) => ({
          id: item._id,
          menuItemId: item.productId, // used in downstream processing
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image || "/placeholder.svg", // Fetch the image from the backend or use a placeholder
        }));
  
        setCartItems(items);
      } catch (error) {
        console.error("Failed to fetch cart data:", error);
      }
    };
  
    fetchCart();
  }, []);
  

  const updateQuantity = async (id: string, change: number) => {
    const item = cartItems.find((item) => item.id === id);
    if (!item) return;

    const newQuantity = Math.max(1, item.quantity + change);

    try {
      const userId = localStorage.getItem("userId");
      await axios.post("http://localhost:3005/api/cart/update", {
        userId,
        productId: item.menuItemId,
        quantity: newQuantity,
      });

      setCartItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item))
      );
    } catch (error) {
      console.error("Failed to update quantity:", error);
    }
  };

  const removeItem = async (id: string) => {
    const item = cartItems.find((item) => item.id === id);
    if (!item) return;

    try {
      const userId = localStorage.getItem("userId");
      await axios.post("http://localhost:3005/api/cart/remove", {
        userId,
        productId: item.menuItemId,
      });

      setCartItems((prev) => prev.filter((i) => i.id !== id));
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = 300;
  const tax = subtotal * 0.08;
  const total = subtotal + deliveryFee + tax;

  const proceedToCheckout = () => {
    if (cartItems.length === 0) {
      console.warn("Cart is empty.");
      return;
    }
  
    // Store full cart in localStorage
    localStorage.setItem("checkoutCart", JSON.stringify(cartItems));
    localStorage.setItem("selectedItem", ""); // clear single item if any
    localStorage.setItem("selectedQuantity", ""); // clear single item quantity
  
    // Optional: You can still store pricing breakdown if needed
    localStorage.setItem("checkoutSubtotal", subtotal.toFixed(2));
    localStorage.setItem("checkoutDeliveryFee", deliveryFee.toFixed(2));
    localStorage.setItem("checkoutTax", tax.toFixed(2));
    localStorage.setItem("checkoutTotal", total.toFixed(2));
  
    // Save restaurant ID if not already present
    const storedRestaurantId = localStorage.getItem("restaurantId");
    if (!storedRestaurantId) {
      const guessedRestaurantId = cartItems[0]?.menuItemId?.split("-")?.[0]; // fallback logic if needed
      if (guessedRestaurantId) {
        localStorage.setItem("restaurantId", guessedRestaurantId);
      }
    }
  
    // Navigate to checkout
    router.push("/checkout");
  };
  

  return (
    <div>
      <Header cartCount={cartItems.length} />
      <div className="container py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Your Cart</h1>
            <p className="text-gray-500">Review your items and proceed to checkout</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {cartItems.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {cartItems.map((item) => (
                    <Card key={item.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="relative h-24 w-24 rounded-md overflow-hidden flex-shrink-0">
                          <Image
                            src={item.image || "/placeholder.svg"}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />

                          </div>
                          <div className="flex flex-col flex-1 justify-between">
                            <div>
                              <h3 className="font-semibold">{item.name}</h3>
                              <p className="text-sm text-gray-500">
                                Menu Item ID: {item.menuItemId}
                              </p>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                              <div className="font-medium">
                                LKR {(item.price * item.quantity).toFixed(2)}
                              </div>
                              <div className="flex items-center gap-3">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateQuantity(item.id, -1)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span>{item.quantity}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateQuantity(item.id, 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500"
                                  onClick={() => removeItem(item.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
                      <p className="text-gray-500 mb-6">
                        Add some delicious items to your cart
                      </p>
                      <Button onClick={() => router.push("/restaurants")}>Browse Restaurants</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span>LKR {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Delivery Fee</span>
                      <span>LKR {deliveryFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tax</span>
                      <span>LKR {tax.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>LKR {total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={cartItems.length === 0}
                    onClick={proceedToCheckout}
                  >
                    Proceed to Checkout
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
