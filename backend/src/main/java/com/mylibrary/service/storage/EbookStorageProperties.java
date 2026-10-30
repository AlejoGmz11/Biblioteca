package com.mylibrary.service.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Conexión al almacenamiento S3-compatible de ebooks. Con {@code endpoint}
 * vacío se usa AWS S3 real; en desarrollo apunta a MinIO.
 */
@ConfigurationProperties(prefix = "app.ebook.storage")
public record EbookStorageProperties(
        String bucket,
        String region,
        String endpoint,
        String accessKey,
        String secretKey,
        boolean pathStyleAccess,
        boolean createBucket
) {

    public boolean hasCustomEndpoint() {
        return endpoint != null && !endpoint.isBlank();
    }

    public boolean hasStaticCredentials() {
        return accessKey != null && !accessKey.isBlank()
                && secretKey != null && !secretKey.isBlank();
    }
}
