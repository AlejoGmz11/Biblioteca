package com.mylibrary.service.storage;

import lombok.Builder;
import org.springframework.web.multipart.MultipartFile;

@Builder
public record ImagePayload(String url, MultipartFile file) {

    public static ImagePayload ofUrl(String url) {
        return ImagePayload.builder().url(url).build();
    }

    public static ImagePayload ofFile(MultipartFile file) {
        return ImagePayload.builder().file(file).build();
    }
}
