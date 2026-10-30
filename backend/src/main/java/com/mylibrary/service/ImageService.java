package com.mylibrary.service;

import com.mylibrary.service.storage.ImagePayload;
import com.mylibrary.service.storage.ImageSource;
import com.mylibrary.service.storage.ImageStorageContext;
import com.mylibrary.service.storage.StoredImageReader;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ImageService {

    private final ImageStorageContext storageContext;
    private final StoredImageReader imageReader;

    /** Stores an uploaded cover and returns the filename to reference it. */
    public String upload(MultipartFile file) {
        return storageContext.store(ImageSource.UPLOAD, ImagePayload.ofFile(file));
    }

    /** Validates an external cover URL through the URL strategy. */
    public String registerUrl(String url) {
        return storageContext.store(ImageSource.URL, ImagePayload.ofUrl(url));
    }

    public Resource load(String filename) {
        return imageReader.load(filename);
    }
}
