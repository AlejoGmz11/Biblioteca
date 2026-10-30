package com.mylibrary.exception;

/** El rango pedido con la cabecera Range queda fuera del archivo (HTTP 416). */
public class RangeNotSatisfiableException extends RuntimeException {

    private final long totalLength;

    public RangeNotSatisfiableException(long totalLength) {
        super("Rango solicitado no satisfacible");
        this.totalLength = totalLength;
    }

    public long getTotalLength() {
        return totalLength;
    }
}
