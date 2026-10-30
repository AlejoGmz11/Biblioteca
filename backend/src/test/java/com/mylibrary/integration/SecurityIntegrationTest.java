package com.mylibrary.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class SecurityIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void dbProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("app.rate-limit.auth-requests-per-minute", () -> 5);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void protectedEndpointsRejectAnonymousRequestsWith401() throws Exception {
        mockMvc.perform(get("/api/books")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/stats/dashboard")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/categories")).andExpect(status().isUnauthorized());
    }

    @Test
    void invalidTokenIsRejectedWith401() throws Exception {
        mockMvc.perform(get("/api/books")
                        .header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void authEndpointsAreRateLimited() throws Exception {
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/login")
                    .with(request -> {
                        request.setRemoteAddr("10.9.9.9");
                        return request;
                    })
                    .contentType("application/json")
                    .content("""
                            {"username":"nobody","password":"wrongpass"}
                            """));
        }
        mockMvc.perform(post("/api/auth/login")
                        .with(request -> {
                            request.setRemoteAddr("10.9.9.9");
                            return request;
                        })
                        .contentType("application/json")
                        .content("""
                                {"username":"nobody","password":"wrongpass"}
                                """))
                .andExpect(status().isTooManyRequests());
    }
}
