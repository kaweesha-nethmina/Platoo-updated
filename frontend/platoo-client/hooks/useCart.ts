import { useState, useEffect } from "react";
import axios from "axios";

type CartItemType = {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
};

type CartAPIResponse = {
  _id: string;
  userId: string;
  items: {
    _id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
};

export const useCart = () => {
  const [cartItems, setCartItems] = useState<CartItemType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchCart = async () => {
      const userId = localStorage.getItem("userId");
      if (!userId) return;

      try {
        const response = await axios.get<CartAPIResponse>(`http://localhost:3005/api/cart/${userId}`);
        const items = response.data.items.map((item) => ({
          id: item._id,
          menuItemId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: "/placeholder.svg", // Placeholder for images
        }));
        setCartItems(items);
      } catch (error) {
        console.error("Failed to fetch cart data:", error);
      } finally {
        setIsLoading(false);
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
  const deliveryFee = 2.99;
  const tax = subtotal * 0.08;
  const total = subtotal + deliveryFee + tax;

  return {
    cartItems,
    isLoading,
    updateQuantity,
    removeItem,
    subtotal,
    deliveryFee,
    tax,
    total,
  };
};
