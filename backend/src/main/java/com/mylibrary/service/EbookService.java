package com.mylibrary.service;

import com.mylibrary.domain.Book;
import com.mylibrary.domain.BookType;
import com.mylibrary.domain.EbookFormat;
import com.mylibrary.dto.book.BookRequest;
import com.mylibrary.dto.book.BookResponse;
import com.mylibrary.exception.BadRequestException;
import com.mylibrary.exception.RangeNotSatisfiableException;
import com.mylibrary.exception.ResourceNotFoundException;
import com.mylibrary.mapper.BookMapper;
import com.mylibrary.service.ebook.EbookFormatDetector;
import com.mylibrary.service.ebook.EbookMetadata;
import com.mylibrary.service.ebook.EbookMetadataExtractor;
import com.mylibrary.service.ebook.EbookOpenResult;
import com.mylibrary.service.storage.EbookContent;
import com.mylibrary.service.storage.EbookStorage;
import com.mylibrary.util.TransactionHooks;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpRange;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;

/**
 * Ebooks (PDF/EPUB) adjuntos a los libros: subida con validación por
 * contenido, extracción de metadatos, lectura con soporte de rangos y borrado.
 * Los archivos se eliminan del almacenamiento solo cuando la transacción
 * de base de datos confirma, para no dejar libros apuntando a archivos que
 * ya no existen.
 */
@Service
@Slf4j
public class EbookService {

    private static final String FALLBACK_AUTHOR = "Autor desconocido";
    private static final String FALLBACK_TITLE = "Sin título";

    private final BookService bookService;
    private final BookMapper bookMapper;
    private final EbookStorage storage;
    private final EbookFormatDetector formatDetector;
    private final EbookMetadataExtractor metadataExtractor;
    private final long maxSizeBytes;

    public EbookService(BookService bookService,
                        BookMapper bookMapper,
                        EbookStorage storage,
                        EbookFormatDetector formatDetector,
                        EbookMetadataExtractor metadataExtractor,
                        @Value("${app.ebook.max-size-mb}") long maxSizeMb) {
        this.bookService = bookService;
        this.bookMapper = bookMapper;
        this.storage = storage;
        this.formatDetector = formatDetector;
        this.metadataExtractor = metadataExtractor;
        this.maxSizeBytes = maxSizeMb * 1024 * 1024;
    }

    /** Adjunta (o sustituye) el archivo de un libro existente, de cualquier tipo. */
    @Transactional
    public BookResponse attach(Long userId, Long bookId, MultipartFile file) {
        Book book = bookService.findOwnedBook(userId, bookId);
        Path temp = toTempFile(file);
        try {
            EbookFormat format = formatDetector.detect(temp);
            EbookMetadata metadata = metadataExtractor.extract(temp, format);
            String previousKey = book.getEbookKey();

            storeOn(book, temp, format);
            fillMissingFields(book, metadata);

            if (previousKey != null) {
                deleteAfterCommit(previousKey);
            }
            return bookMapper.toResponse(book);
        } finally {
            deleteQuietly(temp);
        }
    }

    /**
     * Crea un libro digital a partir del archivo. Los metadatos explícitos
     * tienen prioridad; después los del archivo; por último el nombre del
     * archivo como título.
     */
    @Transactional
    public BookResponse createFromFile(Long userId, MultipartFile file, String title, String author) {
        Path temp = toTempFile(file);
        try {
            EbookFormat format = formatDetector.detect(temp);
            EbookMetadata metadata = metadataExtractor.extract(temp, format);

            BookRequest request = BookRequest.builder()
                    .title(firstNonBlank(title, metadata.title(), baseName(file.getOriginalFilename()), FALLBACK_TITLE))
                    .author(firstNonBlank(author, metadata.author(), FALLBACK_AUTHOR))
                    .pages(metadata.pages())
                    .type(BookType.DIGITAL)
                    .categoryIds(List.of())
                    .build();
            BookResponse created = bookService.create(userId, request);
            Book book = bookService.findOwnedBook(userId, created.id());

            storeOn(book, temp, format);
            return bookMapper.toResponse(book);
        } finally {
            deleteQuietly(temp);
        }
    }

    /** Abre el archivo completo o el rango pedido (cabecera Range, solo el primero). */
    @Transactional(readOnly = true)
    public EbookOpenResult open(Long userId, Long bookId, String rangeHeader) {
        Book book = bookService.findOwnedBook(userId, bookId);
        if (!book.hasEbook()) {
            throw new ResourceNotFoundException("Este libro no tiene ebook adjunto");
        }
        long total = book.getEbookSize();
        Long start = null;
        Long end = null;
        HttpRange range = parseFirstRange(rangeHeader);
        if (range != null) {
            start = range.getRangeStart(total);
            end = range.getRangeEnd(total);
            if (start >= total || start > end) {
                throw new RangeNotSatisfiableException(total);
            }
        }
        EbookContent content = storage.load(book.getEbookKey(), total, start, end);
        return new EbookOpenResult(content, book.getEbookFormat(), downloadFilename(book));
    }

    /** Quita el archivo del libro; el libro en sí se conserva. */
    @Transactional
    public BookResponse remove(Long userId, Long bookId) {
        Book book = bookService.findOwnedBook(userId, bookId);
        if (!book.hasEbook()) {
            throw new ResourceNotFoundException("Este libro no tiene ebook adjunto");
        }
        deleteAfterCommit(book.getEbookKey());
        book.setEbookKey(null);
        book.setEbookFormat(null);
        book.setEbookSize(null);
        return bookMapper.toResponse(book);
    }

    // --- helpers ---

    private void storeOn(Book book, Path file, EbookFormat format) {
        String key = UUID.randomUUID() + format.extension();
        storage.store(key, file, format.mediaType());
        // Si la transacción no confirma, el archivo recién subido quedaría huérfano
        TransactionHooks.afterRollback(() -> storage.delete(key));
        book.setEbookKey(key);
        book.setEbookFormat(format);
        book.setEbookSize(sizeOf(file));
    }

    /** Solo rellena lo que esté vacío: nunca pisa datos del usuario. */
    private static void fillMissingFields(Book book, EbookMetadata metadata) {
        if (isBlank(book.getTitle()) && metadata.hasTitle()) {
            book.setTitle(metadata.title());
        }
        if (isBlank(book.getAuthor()) && metadata.hasAuthor()) {
            book.setAuthor(metadata.author());
        }
        if (book.getPages() == null && metadata.pages() != null) {
            book.setPages(metadata.pages());
        }
    }

    private Path toTempFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("El archivo del ebook es obligatorio");
        }
        if (file.getSize() > maxSizeBytes) {
            throw new BadRequestException("El archivo supera el tamaño máximo de "
                    + (maxSizeBytes / (1024 * 1024)) + " MB");
        }
        try {
            Path temp = Files.createTempFile("ebook-", ".upload");
            file.transferTo(temp);
            return temp;
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo procesar el archivo subido", e);
        }
    }

    private static HttpRange parseFirstRange(String header) {
        if (header == null || header.isBlank()) {
            return null;
        }
        try {
            List<HttpRange> ranges = HttpRange.parseRanges(header);
            return ranges.isEmpty() ? null : ranges.get(0);
        } catch (IllegalArgumentException e) {
            // Cabecera Range mal formada: se ignora y se sirve el archivo completo
            return null;
        }
    }

    private static String downloadFilename(Book book) {
        String base = book.getTitle() == null ? "ebook" : book.getTitle()
                .replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "")
                .trim();
        if (base.isEmpty()) {
            base = "ebook";
        }
        return base + book.getEbookFormat().extension();
    }

    private static String baseName(String originalFilename) {
        if (originalFilename == null) {
            return null;
        }
        String name = originalFilename.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private static String firstNonBlank(String... candidates) {
        for (String candidate : candidates) {
            if (!isBlank(candidate)) {
                return candidate.trim();
            }
        }
        return null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static long sizeOf(Path file) {
        try {
            return Files.size(file);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static void deleteQuietly(Path file) {
        try {
            Files.deleteIfExists(file);
        } catch (IOException e) {
            log.warn("No se pudo borrar el temporal {}", file);
        }
    }

    private void deleteAfterCommit(String key) {
        TransactionHooks.afterCommit(() -> {
            try {
                storage.delete(key);
            } catch (Exception e) {
                log.warn("No se pudo borrar el ebook {} del almacenamiento: {}", key, e.getMessage());
            }
        });
    }
}
