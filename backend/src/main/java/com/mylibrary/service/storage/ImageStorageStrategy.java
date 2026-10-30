package com.mylibrary.service.storage;

/**
 * Strategy Pattern: each implementation handles one way of storing a cover
 * image (external URL vs local upload). New sources can be plugged in without
 * modifying existing code (Open/Closed).
 */
public interface ImageStorageStrategy {

    ImageSource supports();

    /** Stores the payload and returns the reference to persist (URL or filename). */
    String store(ImagePayload payload);
}
