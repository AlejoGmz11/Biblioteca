package com.mylibrary.service.ebook;

import lombok.Builder;

/** Metadatos extraídos del propio archivo; cualquier campo puede ser null. */
@Builder
public record EbookMetadata(String title, String author, Integer pages) {

    public static final EbookMetadata EMPTY = EbookMetadata.builder().build();

    public boolean hasTitle() {
        return title != null && !title.isBlank();
    }

    public boolean hasAuthor() {
        return author != null && !author.isBlank();
    }
}
