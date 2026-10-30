package com.mylibrary.service.storage;

import com.mylibrary.exception.BadRequestException;
import org.springframework.stereotype.Component;

import java.net.URI;

/** Strategy for covers referenced by an external URL: validate and pass through. */
@Component
public class UrlImageStorageStrategy implements ImageStorageStrategy {

    @Override
    public ImageSource supports() {
        return ImageSource.URL;
    }

    @Override
    public String store(ImagePayload payload) {
        String url = payload.url();
        if (url == null || url.isBlank()) {
            throw new BadRequestException("La URL de la imagen es obligatoria");
        }
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                throw new BadRequestException("La URL debe usar http o https");
            }
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("La URL de la imagen no es válida");
        }
        return url;
    }
}
