package com.mylibrary.service.storage;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;
import java.nio.file.Path;

/**
 * Almacenamiento en cualquier servicio compatible con S3. MinIO (desarrollo)
 * y AWS S3 (producción) comparten cliente: solo cambian endpoint, credenciales
 * y el estilo de acceso al bucket, todo ello configurable por perfil.
 */
@Component
@Slf4j
public class S3EbookStorage implements EbookStorage {

    private final EbookStorageProperties properties;
    private final S3Client s3;

    public S3EbookStorage(EbookStorageProperties properties) {
        this.properties = properties;
        this.s3 = buildClient(properties);
    }

    private static S3Client buildClient(EbookStorageProperties props) {
        var builder = S3Client.builder()
                .region(Region.of(props.region()))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(props.pathStyleAccess())
                        .build());
        if (props.hasCustomEndpoint()) {
            builder.endpointOverride(URI.create(props.endpoint()));
        }
        if (props.hasStaticCredentials()) {
            builder.credentialsProvider(StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(props.accessKey(), props.secretKey())));
        }
        // Sin credenciales explícitas el SDK usa su cadena por defecto (env, perfil, IAM role...)
        return builder.build();
    }

    @PostConstruct
    void ensureBucket() {
        if (!properties.createBucket()) {
            return;
        }
        try {
            s3.headBucket(HeadBucketRequest.builder().bucket(properties.bucket()).build());
        } catch (NoSuchBucketException e) {
            log.info("Creando bucket de ebooks '{}'", properties.bucket());
            s3.createBucket(CreateBucketRequest.builder().bucket(properties.bucket()).build());
        } catch (Exception e) {
            // No bloquear el arranque: el error real aparecerá al usar el almacenamiento
            log.warn("No se pudo comprobar el bucket de ebooks '{}': {}", properties.bucket(), e.getMessage());
        }
    }

    @Override
    public void store(String key, Path file, String contentType) {
        s3.putObject(PutObjectRequest.builder()
                        .bucket(properties.bucket())
                        .key(key)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromFile(file));
        log.debug("Ebook almacenado en s3://{}/{}", properties.bucket(), key);
    }

    @Override
    public EbookContent load(String key, long totalLength, Long rangeStart, Long rangeEnd) {
        var request = GetObjectRequest.builder().bucket(properties.bucket()).key(key);
        if (rangeStart != null) {
            // S3 soporta Range de forma nativa: solo viajan los bytes pedidos
            request.range("bytes=" + rangeStart + "-" + rangeEnd);
        }
        try {
            ResponseInputStream<GetObjectResponse> stream = s3.getObject(request.build());
            long length = rangeStart == null ? totalLength : rangeEnd - rangeStart + 1;
            return new EbookContent(stream, length, totalLength, rangeStart, rangeEnd);
        } catch (NoSuchKeyException e) {
            throw new com.mylibrary.exception.ResourceNotFoundException("El archivo del ebook no se encuentra en el almacenamiento");
        }
    }

    @Override
    public void delete(String key) {
        s3.deleteObject(DeleteObjectRequest.builder().bucket(properties.bucket()).key(key).build());
        log.debug("Ebook eliminado de s3://{}/{}", properties.bucket(), key);
    }

    @PreDestroy
    void close() {
        s3.close();
    }
}
