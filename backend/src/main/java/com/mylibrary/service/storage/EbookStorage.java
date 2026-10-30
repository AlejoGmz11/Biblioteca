package com.mylibrary.service.storage;

import java.nio.file.Path;

/**
 * Almacenamiento de archivos de ebook. Sigue el mismo espíritu que
 * {@link ImageStorageStrategy}: la lógica de negocio no sabe dónde viven los
 * bytes, solo maneja claves opacas.
 */
public interface EbookStorage {

    /** Sube el archivo bajo la clave indicada. */
    void store(String key, Path file, String contentType);

    /**
     * Abre el archivo completo o un fragmento. {@code totalLength} permite
     * validar el rango sin una petición extra al almacenamiento.
     *
     * @param rangeStart inicio inclusive del rango, o null para el archivo completo
     * @param rangeEnd   fin inclusive del rango (ignorado si rangeStart es null)
     */
    EbookContent load(String key, long totalLength, Long rangeStart, Long rangeEnd);

    /** Elimina el archivo; no falla si ya no existe. */
    void delete(String key);
}
