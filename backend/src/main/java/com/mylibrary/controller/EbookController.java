package com.mylibrary.controller;

import com.mylibrary.dto.ApiResponse;
import com.mylibrary.dto.book.BookResponse;
import com.mylibrary.security.UserPrincipal;
import com.mylibrary.service.LibraryFacade;
import com.mylibrary.service.ebook.EbookOpenResult;
import com.mylibrary.service.storage.EbookContent;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Ebooks adjuntos a los libros. La lectura y la descarga pasan siempre por
 * aquí (con JWT y comprobación de propietario); nunca se exponen URLs del
 * almacenamiento. Soporta la cabecera Range para que el lector pida solo
 * los fragmentos que necesita.
 */
@RestController
@RequestMapping("/api/books")
@RequiredArgsConstructor
public class EbookController {

    private final LibraryFacade library;

    @PostMapping(value = "/{id}/ebook", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<BookResponse>> attach(@AuthenticationPrincipal UserPrincipal user,
                                                            @PathVariable Long id,
                                                            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.ok("Ebook adjuntado", library.attachEbook(user.getId(), id, file)));
    }

    @PostMapping(value = "/ebook", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<BookResponse>> createFromFile(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String author) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Libro creado a partir del ebook",
                        library.createBookFromEbook(user.getId(), file, title, author)));
    }

    /** Lectura en línea (para el lector integrado). */
    @GetMapping("/{id}/ebook")
    public ResponseEntity<StreamingResponseBody> read(@AuthenticationPrincipal UserPrincipal user,
                                                      @PathVariable Long id,
                                                      @RequestHeader(value = HttpHeaders.RANGE, required = false) String range) {
        return serve(library.openEbook(user.getId(), id, range), false);
    }

    /** Descarga del archivo original. */
    @GetMapping("/{id}/ebook/download")
    public ResponseEntity<StreamingResponseBody> download(@AuthenticationPrincipal UserPrincipal user,
                                                          @PathVariable Long id,
                                                          @RequestHeader(value = HttpHeaders.RANGE, required = false) String range) {
        return serve(library.openEbook(user.getId(), id, range), true);
    }

    @DeleteMapping("/{id}/ebook")
    public ResponseEntity<ApiResponse<BookResponse>> remove(@AuthenticationPrincipal UserPrincipal user,
                                                            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Ebook eliminado", library.removeEbook(user.getId(), id)));
    }

    private static ResponseEntity<StreamingResponseBody> serve(EbookOpenResult result, boolean attachment) {
        EbookContent content = result.content();
        ContentDisposition disposition = (attachment ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(result.filename(), StandardCharsets.UTF_8)
                .build();

        ResponseEntity.BodyBuilder response = ResponseEntity
                .status(content.isPartial() ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK)
                .contentType(MediaType.parseMediaType(result.format().mediaType()))
                .contentLength(content.contentLength())
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=0");
        if (content.isPartial()) {
            response.header(HttpHeaders.CONTENT_RANGE, content.contentRangeHeader());
        }

        // StreamingResponseBody (y no Resource) para que Spring no vuelva a aplicar el Range
        StreamingResponseBody body = output -> {
            try (content) {
                content.stream().transferTo(output);
            } catch (IOException e) {
                throw e;
            } catch (Exception e) {
                throw new IOException("Error cerrando el ebook", e);
            }
        };
        return response.body(body);
    }
}
