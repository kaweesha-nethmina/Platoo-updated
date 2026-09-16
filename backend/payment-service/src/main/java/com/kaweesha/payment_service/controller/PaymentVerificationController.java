package com.kaweesha.payment_service.controller;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PaymentVerificationController {

    @Value("${stripe.secretKey}")
    private String secretKey;

    public PaymentVerificationController() {
        // Initialize Stripe API key
        Stripe.apiKey = secretKey;
    }

    @GetMapping("/api/verify-payment/{sessionId}")
    public ResponseEntity<String> verifyPayment(@PathVariable String sessionId) {
        try {
            // Retrieve the session from Stripe using the sessionId
            Session session = Session.retrieve(sessionId);

            // Retrieve the order_id from metadata
            String orderId = session.getMetadata().get("order_id");

            // Check if the payment was successful
            if ("paid".equals(session.getPaymentStatus())) {
                return ResponseEntity.ok("{\"status\": \"success\", \"orderId\": \"" + orderId + "\"}");
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("{\"status\": \"failed\", \"message\": \"Payment not successful.\"}");
            }
        } catch (StripeException e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("{\"status\": \"failed\", \"message\": \"Stripe error: " + e.getMessage() + "\"}");
        }
    }
}
