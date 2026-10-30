package com.mylibrary.domain;

public enum EbookFormat {
    PDF("application/pdf", ".pdf"),
    EPUB("application/epub+zip", ".epub");

    private final String mediaType;
    private final String extension;

    EbookFormat(String mediaType, String extension) {
        this.mediaType = mediaType;
        this.extension = extension;
    }

    public String mediaType() {
        return mediaType;
    }

    public String extension() {
        return extension;
    }
}
