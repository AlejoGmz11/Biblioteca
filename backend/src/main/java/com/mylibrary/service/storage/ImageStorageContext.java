package com.mylibrary.service.storage;

import com.mylibrary.exception.BadRequestException;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** Strategy context: dispatches to the strategy that supports the image source. */
@Component
public class ImageStorageContext {

    private final Map<ImageSource, ImageStorageStrategy> strategies = new EnumMap<>(ImageSource.class);

    public ImageStorageContext(List<ImageStorageStrategy> available) {
        available.forEach(s -> strategies.put(s.supports(), s));
    }

    public String store(ImageSource source, ImagePayload payload) {
        ImageStorageStrategy strategy = strategies.get(source);
        if (strategy == null) {
            throw new BadRequestException("Origen de imagen no soportado: " + source);
        }
        return strategy.store(payload);
    }
}
