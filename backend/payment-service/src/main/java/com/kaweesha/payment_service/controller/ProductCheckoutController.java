package com.kaweesha.payment_service.controller;

import com.kaweesha.payment_service.dto.ProductRequest;
import com.kaweesha.payment_service.dto.StripeResponse;
import com.kaweesha.payment_service.exception.OrderNotFoundException;
import com.kaweesha.payment_service.service.StripeService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/product/v1")
@CrossOrigin(origins = "${cors.origins:http://localhost:3000}") // Allow requests from the configured frontend origins
public class ProductCheckoutController {


    private StripeService stripeService;

    public ProductCheckoutController(StripeService stripeService) {
        this.stripeService = stripeService;
    }

    @PostMapping("/checkout")
    public ResponseEntity<?> checkoutProducts(@RequestBody ProductRequest productRequest) {
        try {
            StripeResponse stripeResponse = stripeService.checkoutProducts(productRequest);
            return ResponseEntity
                    .status(HttpStatus.OK)
                    .body(stripeResponse);
        } catch (OrderNotFoundException e) {
            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body(Map.of("status", "FAILED", "message", "Order not found"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("status", "FAILED", "message", "Invalid checkout request"));
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "FAILED", "message", "An error occurred while creating the payment session"));
        }
    }
}