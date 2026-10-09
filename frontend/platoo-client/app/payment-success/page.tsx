"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const placeConfirmedOrder = async () => {
      const orderId = localStorage.getItem("order_id");
      if (!orderId) {
        console.error("No pending order found.");
        router.push("/checkout");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session_id");
      if (!sessionId) {
        console.error("No Stripe session id in the URL.");
        router.push("/checkout");
        return;
      }

      // PATCH the order through the order service, which verifies the Stripe
      // session server-side (order-service -> payment-service -> Stripe) and
      // marks the order paid before we show the confirmation page. We never
      // trust localStorage alone.
      try {
        const response = await fetch(
          `/api/proxy/order/orders/${orderId}/payment`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              // (V-08) Authorization removed — BFF proxy injects Bearer from the httpOnly cookie
            },
            body: JSON.stringify({ sessionId }),
          }
        );

        if (!response.ok) {
          console.error("Payment could not be verified:", response.statusText);
          router.push("/checkout");
          return;
        }

        // The order is already persisted (it was created during checkout);
        // just clean up and show the confirmation.
        localStorage.removeItem("pending_order");
        router.push("/order-confirmation");
      } catch (error) {
        console.error("Error verifying payment:", error);
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
