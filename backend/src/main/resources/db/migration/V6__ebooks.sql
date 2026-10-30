-- Ebooks (PDF/EPUB) adjuntos a cualquier tipo de libro. Todas las columnas
-- son opcionales: los libros sin archivo no cambian su comportamiento.
ALTER TABLE books
    ADD COLUMN ebook_key    VARCHAR(500),
    ADD COLUMN ebook_format VARCHAR(10),
    ADD COLUMN ebook_size   BIGINT;

-- Ubicación de lectura para EPUB (CFI); el número de página no aplica.
ALTER TABLE reading_sessions
    ADD COLUMN ebook_location VARCHAR(1000);
