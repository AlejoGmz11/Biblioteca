package com.mylibrary.exception;

/** Un servicio externo del que depende la petición no responde o responde mal. */
public class ExternalServiceException extends RuntimeException {

    public ExternalServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
