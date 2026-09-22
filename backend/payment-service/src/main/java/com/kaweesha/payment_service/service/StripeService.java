package com.kaweesha.payment_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kaweesha.payment_service.dto.ProductRequest;
import com.kaweesha.payment_service.dto.StripeResponse;
import com.kaweesha.payment_service.exception.OrderNotFoundException;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
public class StripeService {

    @Value("${stripe.secretKey}")
    private String secretKey;

    @Value("${order.service.url}")
    private String orderServiceUrl;

    @Value("${internal.service.key:}")
    private String internalServiceKey;

    public StripeResponse checkoutProducts(ProductRequest productRequest) {
        // Set your secret key
        Stripe.apiKey = secretKey;

        // A reference to an already-persisted order is mandatory. The amount is
        // always recomputed from the server-side order record; the client-supplied
        // monetary values are never trusted.
        if (productRequest.getOrderId() == null || productRequest.getOrderId().isBlank()) {
            throw new IllegalArgumentException("An order reference (orderId) is required");
        }

        String orderId = productRequest.getOrderId();
        long trustedAmountInSmallestUnit = computeTrustedAmount(orderId);

        // Create a PriceData.Quantity-aware line item for the session.
        SessionCreateParams.LineItem.PriceData.ProductData productData =
                SessionCreateParams.LineItem.PriceData.ProductData.builder()
                        .setName("Food Order " + orderId)
                        .build();

        SessionCreateParams.LineItem.PriceData priceData =
                SessionCreateParams.LineItem.PriceData.builder()
                        .setCurrency("lkr")
                        .setUnitAmount(trustedAmountInSmallestUnit)
                        .setProductData(productData)
                        .build();

        SessionCreateParams.LineItem lineItem =
                SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(priceData)
                        .build();

        SessionCreateParams params =
                SessionCreateParams.builder()
                        .setMode(SessionCreateParams.Mode.PAYMENT)
                        .setSuccessUrl("http://localhost:3000/payment-success?session_id={CHECKOUT_SESSION_ID}")
                        .setCancelUrl("http://localhost:3000/checkout")
                        .addLineItem(lineItem)
                        .putMetadata("order_id", orderId)
                        .build();

        try {
            Session session = Session.create(params);
            return StripeResponse
                    .builder()
                    .status("SUCCESS")
                    .message("Payment session created")
                    .sessionId(session.getId())
                    .sessionUrl(session.getUrl())
                    .build();
        } catch (StripeException e) {
            throw new IllegalStateException("Failed to create payment session", e);
        }
    }

    /**
     * Recomputes the payable amount from the persisted order.
     * total = sum(item.price * item.quantity) + delivery_fee.
     */
    private long computeTrustedAmount(String orderId) {
        JsonNode order = fetchOrder(orderId);

        double trustedTotal = 0;
        JsonNode items = order.get("items");
        if (items != null && items.isArray()) {
            for (JsonNode item : items) {
                double price = item.path("price").asDouble(0);
                int quantity = item.path("quantity").asInt(0);
                if (price < 0 || quantity < 0) {
                    throw new IllegalArgumentException("Order contains invalid item values");
                }
                trustedTotal += price * quantity;
            }
        }

        trustedTotal += order.path("delivery_fee").asDouble(0);

        long amountInSmallestUnit = Math.round(trustedTotal * 100);
        if (amountInSmallestUnit <= 0) {
            throw new IllegalArgumentException("Order has no payable amount");
        }
        return amountInSmallestUnit;
    }

    private JsonNode fetchOrder(String orderId) {
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(orderServiceUrl + "/api/orders/" + orderId))
                .timeout(Duration.ofSeconds(5));

        // Trusted service-to-service authentication (V-04): the order-service
        // treats callers presenting the shared internal key as authorized.
        if (internalServiceKey != null && !internalServiceKey.isBlank()) {
            requestBuilder.header("x-internal-key", internalServiceKey);
        }

        HttpRequest request = requestBuilder.build();

        HttpResponse<String> response;
        try {
            response = HttpClient.newHttpClient().send(
                    request, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new IllegalStateException("Could not reach the order service", e);
        }

        if (response.statusCode() == 404) {
            throw new OrderNotFoundException("Order not found: " + orderId);
        }
        if (response.statusCode() != 200) {
            throw new OrderNotFoundException("Order not found: " + orderId);
        }

        try {
            JsonNode tree = new ObjectMapper().readTree(response.body());
            if (tree == null || !tree.isObject()) {
                throw new OrderNotFoundException("Order not found: " + orderId);
            }
            return tree;
        } catch (Exception e) {
            throw new OrderNotFoundException("Order not found: " + orderId);
        }
    }
}