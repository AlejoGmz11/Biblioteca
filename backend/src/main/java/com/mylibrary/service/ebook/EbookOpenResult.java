package com.mylibrary.service.ebook;

import com.mylibrary.domain.EbookFormat;
import com.mylibrary.service.storage.EbookContent;

/** Lo que necesita el controlador para servir un ebook: bytes, tipo y nombre. */
public record EbookOpenResult(EbookContent content, EbookFormat format, String filename) {
}
