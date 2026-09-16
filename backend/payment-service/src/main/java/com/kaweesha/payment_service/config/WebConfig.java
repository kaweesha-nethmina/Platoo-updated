package com.kaweesha.payment_service.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // Allow all origins (use specific origins in production for security reasons)
        registry.addMapping("/**")
                .allowedOrigins("http://localhost:8000") // Allow only localhost:8000 (or your frontend origin)
                .allowedMethods("GET", "POST", "PUT", "DELETE")
                .allowedHeaders("*")
                .allowCredentials(true); // If you need to send cookies or authentication headers
    }
}
