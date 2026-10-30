package com.mylibrary.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * End-to-end flow against a real PostgreSQL (Testcontainers): register, login,
 * create a book, move it through the reading lifecycle and check stats/export.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class MyLibraryIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void dbProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        // Effectively disable rate limiting for the test run
        registry.add("app.rate-limit.auth-requests-per-minute", () -> 10_000);
    }

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    private static String accessToken;
    private static long bookId;

    @Test
    @Order(1)
    void registerAndLogin() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"reader","email":"reader@test.com","password":"secret123"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty());

        MvcResult login = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"reader","password":"secret123"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(login.getResponse().getContentAsString());
        accessToken = body.at("/data/accessToken").asText();
    }

    @Test
    @Order(2)
    void createBookStartsWithPendingSession() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/books")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Dune","author":"Frank Herbert","pages":412,"type":"PHYSICAL",
                                 "categoryIds":[1,3],"saga":"Crónicas de Dune","sagaOrder":1}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.type").value("PHYSICAL"))
                .andExpect(jsonPath("$.data.session.status").value("PENDING"))
                .andExpect(jsonPath("$.data.categories.length()").value(2))
                .andExpect(jsonPath("$.data.sagaName").value("Crónicas de Dune"))
                .andExpect(jsonPath("$.data.sagaOrder").value(1))
                .andReturn();

        bookId = objectMapper.readTree(result.getResponse().getContentAsString())
                .at("/data/id").asLong();
    }

    @Test
    @Order(3)
    void readingLifecycleUpdatesSession() throws Exception {
        mockMvc.perform(patch("/api/books/{id}/session", bookId)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"READING","currentPage":50}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("READING"))
                .andExpect(jsonPath("$.data.startDate").isNotEmpty());

        mockMvc.perform(patch("/api/books/{id}/session", bookId)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"FINISHED","rating":4.5,"notes":"Obra maestra"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("FINISHED"))
                .andExpect(jsonPath("$.data.rating").value(4.5));
    }

    @Test
    @Order(4)
    void listSupportsFilters() throws Exception {
        mockMvc.perform(get("/api/books")
                        .header("Authorization", "Bearer " + accessToken)
                        .param("status", "FINISHED")
                        .param("search", "dune"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1));

        mockMvc.perform(get("/api/books")
                        .header("Authorization", "Bearer " + accessToken)
                        .param("status", "READING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0));

        // Autoconclusivos: el libro pertenece a una saga, no debe aparecer
        mockMvc.perform(get("/api/books")
                        .header("Authorization", "Bearer " + accessToken)
                        .param("saga", "none"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0));

        mockMvc.perform(get("/api/sagas")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].name").value("Crónicas de Dune"))
                .andExpect(jsonPath("$.data[0].bookCount").value(1));
    }

    @Test
    @Order(5)
    void statsAndExportReflectData() throws Exception {
        mockMvc.perform(get("/api/stats/dashboard")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalBooks").value(1))
                .andExpect(jsonPath("$.data.booksByStatus.FINISHED").value(1))
                .andExpect(jsonPath("$.data.totalPagesRead").value(412));

        mockMvc.perform(get("/api/export/csv")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Dune")));
    }

    @Test
    @Order(6)
    void predefinedCategoryCannotBeDeleted() throws Exception {
        mockMvc.perform(delete("/api/categories/{id}", 1)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(8)
    void passwordCanBeChangedAndOldOneStopsWorking() throws Exception {
        mockMvc.perform(patch("/api/profile/password")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword":"wrong-one","newPassword":"nuevaClave1"}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/api/profile/password")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword":"secret123","newPassword":"nuevaClave1"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"reader","password":"nuevaClave1"}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"reader","password":"secret123"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(7)
    void bookTypeCanBeChanged() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/books")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Fundación","author":"Isaac Asimov","type":"AUDIOBOOK"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.type").value("AUDIOBOOK"))
                .andReturn();
        long id = objectMapper.readTree(created.getResponse().getContentAsString())
                .at("/data/id").asLong();

        mockMvc.perform(put("/api/books/{id}", id)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Fundación","author":"Isaac Asimov","type":"PHYSICAL"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("PHYSICAL"));

        // El resto de datos (la sesión de lectura) se conserva tras el cambio
        mockMvc.perform(get("/api/books/{id}", id)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("PHYSICAL"))
                .andExpect(jsonPath("$.data.session.status").value("PENDING"));
    }
}
