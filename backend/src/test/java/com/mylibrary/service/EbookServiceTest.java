package com.mylibrary.service;

import com.mylibrary.domain.Book;
import com.mylibrary.domain.BookType;
import com.mylibrary.domain.DigitalBook;
import com.mylibrary.domain.EbookFormat;
import com.mylibrary.domain.PhysicalBook;
import com.mylibrary.domain.User;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayInputStream;
import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EbookServiceTest {

    @Mock
    private BookService bookService;
    @Mock
    private BookMapper bookMapper;
    @Mock
    private EbookStorage storage;
    @Mock
    private EbookFormatDetector formatDetector;
    @Mock
    private EbookMetadataExtractor metadataExtractor;

    private EbookService service;

    private final User user = User.builder().id(1L).username("ana").email("a@a.com").password("x").build();
    private final MockMultipartFile upload =
            new MockMultipartFile("file", "mi-libro.pdf", "application/pdf", "%PDF-1.4 contenido".getBytes());

    @BeforeEach
    void setUp() {
        service = new EbookService(bookService, bookMapper, storage, formatDetector, metadataExtractor, 100);
        lenient().when(bookMapper.toResponse(any(Book.class))).thenReturn(mock(BookResponse.class));
    }

    @Test
    void attachStoresFileAndUpdatesBookFields() {
        Book book = PhysicalBook.builder().id(5L).title("Dune").author("Herbert").user(user).build();
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(book);
        when(formatDetector.detect(any(Path.class))).thenReturn(EbookFormat.PDF);
        when(metadataExtractor.extract(any(Path.class), eq(EbookFormat.PDF))).thenReturn(EbookMetadata.EMPTY);

        service.attach(1L, 5L, upload);

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(storage).store(key.capture(), any(Path.class), eq("application/pdf"));
        assertThat(key.getValue()).endsWith(".pdf");
        assertThat(book.getEbookKey()).isEqualTo(key.getValue());
        assertThat(book.getEbookFormat()).isEqualTo(EbookFormat.PDF);
        assertThat(book.getEbookSize()).isEqualTo(upload.getSize());
        // Cualquier tipo de libro admite ebook: este era físico
        assertThat(book.getBookType()).isEqualTo(BookType.PHYSICAL);
    }

    @Test
    void attachReplacesPreviousFileAndDeletesTheOldOne() {
        Book book = DigitalBook.builder().id(5L).title("Dune").author("Herbert").user(user)
                .ebookKey("old-key.epub").ebookFormat(EbookFormat.EPUB).ebookSize(10L).build();
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(book);
        when(formatDetector.detect(any(Path.class))).thenReturn(EbookFormat.PDF);
        when(metadataExtractor.extract(any(), any())).thenReturn(EbookMetadata.EMPTY);

        service.attach(1L, 5L, upload);

        // Fuera de una transacción el borrado del archivo anterior es inmediato
        verify(storage).delete("old-key.epub");
        assertThat(book.getEbookKey()).isNotEqualTo("old-key.epub");
        assertThat(book.getEbookFormat()).isEqualTo(EbookFormat.PDF);
    }

    @Test
    void attachFillsOnlyMissingFieldsFromMetadata() {
        Book book = DigitalBook.builder().id(5L).title("Título del usuario").author("").user(user).build();
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(book);
        when(formatDetector.detect(any(Path.class))).thenReturn(EbookFormat.PDF);
        when(metadataExtractor.extract(any(), any())).thenReturn(
                EbookMetadata.builder().title("Título del PDF").author("Autor del PDF").pages(300).build());

        service.attach(1L, 5L, upload);

        assertThat(book.getTitle()).isEqualTo("Título del usuario"); // no se pisa
        assertThat(book.getAuthor()).isEqualTo("Autor del PDF");     // estaba vacío
        assertThat(book.getPages()).isEqualTo(300);                   // estaba vacío
    }

    @Test
    void attachRejectsFilesOverTheSizeLimit() {
        EbookService small = new EbookService(bookService, bookMapper, storage, formatDetector, metadataExtractor, 0);
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(DigitalBook.builder().id(5L).user(user).build());

        assertThatThrownBy(() -> small.attach(1L, 5L, upload))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("tamaño máximo");
        verify(storage, never()).store(any(), any(), any());
    }

    @Test
    void attachRejectsEmptyUpload() {
        MockMultipartFile empty = new MockMultipartFile("file", "x.pdf", "application/pdf", new byte[0]);
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(DigitalBook.builder().id(5L).user(user).build());

        assertThatThrownBy(() -> service.attach(1L, 5L, empty)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void createFromFilePrefersExplicitThenMetadataThenFilename() {
        when(formatDetector.detect(any(Path.class))).thenReturn(EbookFormat.PDF);
        when(metadataExtractor.extract(any(), any())).thenReturn(
                EbookMetadata.builder().title("Título del PDF").author("Autor del PDF").pages(120).build());
        BookResponse created = mock(BookResponse.class);
        when(created.id()).thenReturn(9L);
        when(bookService.create(eq(1L), any(BookRequest.class))).thenReturn(created);
        Book saved = DigitalBook.builder().id(9L).user(user).build();
        when(bookService.findOwnedBook(1L, 9L)).thenReturn(saved);

        service.createFromFile(1L, upload, "Título explícito", null);

        ArgumentCaptor<BookRequest> request = ArgumentCaptor.forClass(BookRequest.class);
        verify(bookService).create(eq(1L), request.capture());
        assertThat(request.getValue().title()).isEqualTo("Título explícito");
        assertThat(request.getValue().author()).isEqualTo("Autor del PDF");
        assertThat(request.getValue().pages()).isEqualTo(120);
        assertThat(request.getValue().type()).isEqualTo(BookType.DIGITAL);
        assertThat(saved.getEbookKey()).isNotNull();
    }

    @Test
    void createFromFileFallsBackToFilenameAndUnknownAuthor() {
        when(formatDetector.detect(any(Path.class))).thenReturn(EbookFormat.EPUB);
        when(metadataExtractor.extract(any(), any())).thenReturn(EbookMetadata.EMPTY);
        BookResponse created = mock(BookResponse.class);
        when(created.id()).thenReturn(9L);
        when(bookService.create(eq(1L), any(BookRequest.class))).thenReturn(created);
        when(bookService.findOwnedBook(1L, 9L)).thenReturn(DigitalBook.builder().id(9L).user(user).build());

        service.createFromFile(1L, upload, null, null);

        ArgumentCaptor<BookRequest> request = ArgumentCaptor.forClass(BookRequest.class);
        verify(bookService).create(eq(1L), request.capture());
        assertThat(request.getValue().title()).isEqualTo("mi-libro");
        assertThat(request.getValue().author()).isEqualTo("Autor desconocido");
    }

    @Test
    void openWithoutRangeReturnsWholeFile() {
        Book book = ebookBook(1000L);
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(book);
        when(storage.load("k.pdf", 1000L, null, null))
                .thenReturn(new EbookContent(new ByteArrayInputStream(new byte[0]), 1000L, 1000L, null, null));

        EbookOpenResult result = service.open(1L, 5L, null);

        assertThat(result.content().isPartial()).isFalse();
        assertThat(result.format()).isEqualTo(EbookFormat.PDF);
        assertThat(result.filename()).isEqualTo("Dune.pdf");
    }

    @Test
    void openWithRangeForwardsBoundsToStorage() {
        Book book = ebookBook(1000L);
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(book);
        when(storage.load(eq("k.pdf"), eq(1000L), eq(200L), eq(499L)))
                .thenReturn(new EbookContent(new ByteArrayInputStream(new byte[0]), 300L, 1000L, 200L, 499L));

        EbookOpenResult result = service.open(1L, 5L, "bytes=200-499");

        assertThat(result.content().isPartial()).isTrue();
        assertThat(result.content().contentRangeHeader()).isEqualTo("bytes 200-499/1000");
    }

    @Test
    void openWithRangeBeyondFileIs416() {
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(ebookBook(1000L));

        assertThatThrownBy(() -> service.open(1L, 5L, "bytes=5000-6000"))
                .isInstanceOf(RangeNotSatisfiableException.class);
        verify(storage, never()).load(any(), anyLong(), any(), any());
    }

    @Test
    void openMalformedRangeServesWholeFile() {
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(ebookBook(1000L));
        when(storage.load(eq("k.pdf"), eq(1000L), isNull(), isNull()))
                .thenReturn(new EbookContent(new ByteArrayInputStream(new byte[0]), 1000L, 1000L, null, null));

        assertThat(service.open(1L, 5L, "no-es-un-rango").content().isPartial()).isFalse();
    }

    @Test
    void openFailsWhenBookHasNoEbook() {
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(
                DigitalBook.builder().id(5L).title("Dune").author("H").user(user).build());

        assertThatThrownBy(() -> service.open(1L, 5L, null)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void removeClearsFieldsAndDeletesFile() {
        Book book = ebookBook(10L);
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(book);

        service.remove(1L, 5L);

        verify(storage).delete("k.pdf");
        assertThat(book.getEbookKey()).isNull();
        assertThat(book.getEbookFormat()).isNull();
        assertThat(book.getEbookSize()).isNull();
    }

    @Test
    void downloadFilenameStripsUnsafeCharacters() {
        Book book = ebookBook(10L);
        book.setTitle("¿Qué / pasa: aquí?*");
        when(bookService.findOwnedBook(1L, 5L)).thenReturn(book);
        when(storage.load(any(), anyLong(), any(), any()))
                .thenReturn(new EbookContent(new ByteArrayInputStream(new byte[0]), 10L, 10L, null, null));

        assertThat(service.open(1L, 5L, null).filename()).isEqualTo("¿Qué  pasa aquí.pdf");
    }

    private Book ebookBook(long size) {
        return DigitalBook.builder().id(5L).title("Dune").author("Herbert").user(user)
                .ebookKey("k.pdf").ebookFormat(EbookFormat.PDF).ebookSize(size).build();
    }
}
