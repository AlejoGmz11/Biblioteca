package com.mylibrary.service.storage;

import com.mylibrary.exception.BadRequestException;
import com.mylibrary.exception.ResourceNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.UUID;

/** Strategy for covers uploaded as files: stores them under the uploads dir. */
@Component
@Slf4j
public class LocalImageStorageStrategy implements ImageStorageStrategy, StoredImageReader {

    private static final Set<String> ALLOWED_TYPES =
            Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    private final Path uploadDir;

    public LocalImageStorageStrategy(@Value("${app.upload.dir}") String uploadDir) {
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo crear el directorio de subidas", e);
        }
    }

    @Override
    public ImageSource supports() {
        return ImageSource.UPLOAD;
    }

    @Override
    public String store(ImagePayload payload) {
        MultipartFile file = payload.file();
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("El archivo de imagen es obligatorio");
        }
        if (!ALLOWED_TYPES.contains(file.getContentType())) {
            throw new BadRequestException("Formato no soportado. Usa JPEG, PNG, WEBP o GIF");
        }
        String extension = switch (String.valueOf(file.getContentType())) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            default -> ".jpg";
        };
        String filename = UUID.randomUUID() + extension;
        try {
            file.transferTo(uploadDir.resolve(filename));
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo guardar la imagen", e);
        }
        log.debug("Stored uploaded cover as {}", filename);
        return filename;
    }

    @Override
    public Resource load(String filename) {
        Path path = uploadDir.resolve(filename).normalize();
        if (!path.startsWith(uploadDir)) {
            throw new BadRequestException("Nombre de archivo no válido");
        }
        try {
            Resource resource = new UrlResource(path.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResourceNotFoundException("Imagen no encontrada: " + filename);
            }
            return resource;
        } catch (MalformedURLException e) {
            throw new BadRequestException("Nombre de archivo no válido");
        }
    }
}
