package com.mylibrary.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mylibrary.service.ebook.EbookFixtures;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Ciclo completo de un ebook contra PostgreSQL y MinIO reales: crear libro
 * desde archivo, leer por rangos, descargar, aislamiento entre usuarios y
 * borrado.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class EbookIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    static final MinIOContainer minio = new MinIOContainer("quay.io/minio/minio:latest");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("app.ebook.storage.endpoint", minio::getS3URL);
        registry.add("app.ebook.storage.access-key", minio::getUserName);
        registry.add("app.ebook.storage.secret-key", minio::getPassword);
        registry.add("app.ebook.storage.path-style-access", () -> true);
        registry.add("app.ebook.storage.create-bucket", () -> true);
        registry.add("app.rate-limit.auth-requests-per-minute", () -> 10_000);
    }

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    @TempDir
    static Path dir;

    private static String ownerToken;
    private static String otherToken;
    private static long bookId;
    private static byte[] pdfBytes;

    @Test
    @Order(1)
    void registerTwoUsers() throws Exception {
        ownerToken = register("owner");
        otherToken = register("intruder");
    }

    @Test
    @Order(2)
    void createBookFromPdfExtractsMetadata() throws Exception {
        Path pdf = EbookFixtures.pdf(dir, "Fundación", "Isaac Asimov", 4);
        pdfBytes = Files.readAllBytes(pdf);

        MvcResult result = mockMvc.perform(multipart("/api/books/ebook")
                        .file(new MockMultipartFile("file", "fundacion.pdf", "application/pdf", pdfBytes))
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.title").value("Fundación"))
                .andExpect(jsonPath("$.data.author").value("Isaac Asimov"))
                .andExpect(jsonPath("$.data.pages").value(4))
                .andExpect(jsonPath("$.data.type").value("DIGITAL"))
                .andExpect(jsonPath("$.data.ebookFormat").value("PDF"))
                .andExpect(jsonPath("$.data.ebookSize").value(pdfBytes.length))
                .andReturn();
        bookId = objectMapper.readTree(result.getResponse().getContentAsString()).at("/data/id").asLong();
    }

    @Test
    @Order(3)
    void streamsWholeFileAndRanges() throws Exception {
        MvcResult full = mockMvc.perform(get("/api/books/{id}/ebook", bookId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(header().string("Accept-Ranges", "bytes"))
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andReturn();
        assertThat(full.getResponse().getContentAsByteArray()).isEqualTo(pdfBytes);

        MvcResult partial = mockMvc.perform(get("/api/books/{id}/ebook", bookId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .header("Range", "bytes=0-3"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string("Content-Range", "bytes 0-3/" + pdfBytes.length))
                .andReturn();
        assertThat(partial.getResponse().getContentAsString()).isEqualTo("%PDF");

        mockMvc.perform(get("/api/books/{id}/ebook", bookId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .header("Range", "bytes=999999-"))
                .andExpect(status().isRequestedRangeNotSatisfiable());
    }

    @Test
    @Order(4)
    void downloadUsesAttachmentDisposition() throws Exception {
        mockMvc.perform(get("/api/books/{id}/ebook/download", bookId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.startsWith("attachment")));
    }

    @Test
    @Order(5)
    void anotherUserCannotAccessTheEbook() throws Exception {
        mockMvc.perform(get("/api/books/{id}/ebook", bookId)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/books/{id}/ebook", bookId)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(6)
    void attachEpubToExistingPhysicalBookReplacesFile() throws Exception {
        Path epub = EbookFixtures.epub(dir, "Ignorado", "Ignorado");
        mockMvc.perform(multipart("/api/books/{id}/ebook", bookId)
                        .file(new MockMultipartFile("file", "x.epub", "application/epub+zip", Files.readAllBytes(epub)))
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ebookFormat").value("EPUB"))
                // Los campos ya rellenos no se sobrescriben con los metadatos del archivo
                .andExpect(jsonPath("$.data.title").value("Fundación"));
    }

    @Test
    @Order(7)
    void rejectsNonEbookUploads() throws Exception {
        mockMvc.perform(multipart("/api/books/{id}/ebook", bookId)
                        .file(new MockMultipartFile("file", "virus.pdf", "application/pdf", "<html></html>".getBytes()))
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @Order(8)
    void removeEbookKeepsTheBook() throws Exception {
        mockMvc.perform(delete("/api/books/{id}/ebook", bookId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ebookFormat").doesNotExist());

        mockMvc.perform(get("/api/books/{id}", bookId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Fundación"));

        mockMvc.perform(get("/api/books/{id}/ebook", bookId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNotFound());
    }

    private String register(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","email":"%s@test.com","password":"secret123"}
                                """.formatted(username, username)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
