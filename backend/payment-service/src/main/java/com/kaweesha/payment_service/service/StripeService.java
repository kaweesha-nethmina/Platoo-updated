package com.kaweesha.payment_service.service;

import com.kaweesha.payment_service.dto.ProductRequest;
import com.kaweesha.payment_service.dto.StripeResponse;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class StripeService {

    @Value("${stripe.secretKey}")
    private String secretKey;

    public StripeResponse checkoutProducts(ProductRequest productRequest) {
        // Set your secret key
        Stripe.apiKey = secretKey;

        // Directly use the amount as a decimal value (e.g., 13.74)
        long amountInSmallestUnit = (long) (productRequest.getAmount() * 100); // Convert to cents as integer for backend use

        // Ensure currency is set to LKR if not provided
        //String currency = productRequest.getCurrency() != null ? productRequest.getCurrency() : "LKR";

        // Create a ProductData object for the Stripe session
        SessionCreateParams.LineItem.PriceData.ProductData productData =
                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                        .setName(productRequest.getName())
                        .build();

        // Create a priceData object
        SessionCreateParams.LineItem.PriceData priceData =
         SessionCreateParams.LineItem.PriceData.builder()
                 .setCurrency("lkr")  // Make sure it's lowercase "lkr"
                 .setUnitAmount(amountInSmallestUnit) // In cents (rounded)
                 .setProductData(productData)
                 .build();

        // Create a line item for the session
        SessionCreateParams.LineItem lineItem =
                SessionCreateParams.LineItem.builder()
                        .setQuantity(1L) // Set quantity to 1, as the amount already represents the total price
                        .setPriceData(priceData)
                        .build();

        // Create the session parameters
        SessionCreateParams params =
                SessionCreateParams.builder()
                        .setMode(SessionCreateParams.Mode.PAYMENT)
                        .setSuccessUrl("http://localhost:8000/payment-success?session_id={CHECKOUT_SESSION_ID}")
                        .setCancelUrl("http://localhost:8080/cancel")
                        .addLineItem(lineItem)
                        .build();

        // Create the session
        Session session = null;
        try {
            session = Session.create(params);
        } catch (StripeException e) {
            System.err.println("Error creating session: " + e.getMessage());
            e.printStackTrace();
        }

        // Return the session ID and URL for Stripe payment
        return StripeResponse
                .builder()
                .status("SUCCESS")
                .message("Payment session created")
                .sessionId(session != null ? session.getId() : "No Session")
                .sessionUrl(session != null ? session.getUrl() : "No URL")
                .build();
    }
}
