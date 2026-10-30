package com.mylibrary.service.storage;

import org.springframework.core.io.Resource;

/** Read side of locally stored images, kept separate per Interface Segregation. */
public interface StoredImageReader {

    Resource load(String filename);
}
