"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const placeConfirmedOrder = async () => {
      const orderData = localStorage.getItem("pending_order");
      if (!orderData) {
        console.error("No pending order found.");
        router.push("/checkout");
        return;
      }
    
      try {
        const response = await fetch("http://localhost:3008/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: orderData,
        });
    
        if (!response.ok) {
          console.error("Error placing order:", response.statusText);
          return;
        }
    
        const orderConfirmation = await response.json();
        if (orderConfirmation?.order?.order_id) {
          localStorage.setItem("order_id", orderConfirmation.order.order_id);
          localStorage.removeItem("pending_order"); // ✅ cleanup
          router.push("/order-confirmation");
        } else {
          console.error("Order ID not returned.");
          router.push("/checkout");
        }
      } catch (error) {
        console.error("Error placing order after payment:", error);
        router.push("/checkout");
      }
    };
    
    

    placeConfirmedOrder();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Processing your payment and placing the order...</p>
    </div>
  );
}
