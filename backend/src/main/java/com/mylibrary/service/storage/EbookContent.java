package com.mylibrary.service.storage;

import java.io.InputStream;

/**
 * Contenido de un ebook listo para enviar al cliente. Si {@code rangeStart}
 * es null se trata del archivo completo; si no, de un fragmento (HTTP 206).
 */
public record EbookContent(
        InputStream stream,
        long contentLength,
        long totalLength,
        Long rangeStart,
        Long rangeEnd
) implements AutoCloseable {

    public boolean isPartial() {
        return rangeStart != null;
    }

    public String contentRangeHeader() {
        return "bytes " + rangeStart + "-" + rangeEnd + "/" + totalLength;
    }

    @Override
    public void close() throws Exception {
        stream.close();
    }
}
