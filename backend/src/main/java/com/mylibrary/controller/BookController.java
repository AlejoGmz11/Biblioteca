package com.mylibrary.controller;

import com.mylibrary.domain.BookType;
import com.mylibrary.domain.ReadingStatus;
import com.mylibrary.dto.ApiResponse;
import com.mylibrary.dto.PageResponse;
import com.mylibrary.dto.book.BookRequest;
import com.mylibrary.dto.book.BookResponse;
import com.mylibrary.dto.session.ReadingSessionResponse;
import com.mylibrary.dto.session.ReadingSessionUpdateRequest;
import com.mylibrary.security.UserPrincipal;
import com.mylibrary.service.LibraryFacade;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/books")
@RequiredArgsConstructor
public class BookController {

    private final LibraryFacade library;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<BookResponse>>> list(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) ReadingStatus status,
            @RequestParam(required = false) Long category,
            @RequestParam(required = false) BookType type,
            @RequestParam(required = false) String author,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String saga,
            @PageableDefault(size = 12, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.ok(
                library.listBooks(user.getId(), status, category, type, author, search, saga, pageable)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BookResponse>> get(@AuthenticationPrincipal UserPrincipal user,
                                                         @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(library.getBook(user.getId(), id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<BookResponse>> create(@AuthenticationPrincipal UserPrincipal user,
                                                            @Valid @RequestBody BookRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Libro creado", library.createBook(user.getId(), request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<BookResponse>> update(@AuthenticationPrincipal UserPrincipal user,
                                                            @PathVariable Long id,
                                                            @Valid @RequestBody BookRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Libro actualizado", library.updateBook(user.getId(), id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@AuthenticationPrincipal UserPrincipal user,
                                                    @PathVariable Long id) {
        library.deleteBook(user.getId(), id);
        return ResponseEntity.ok(ApiResponse.ok("Libro eliminado", null));
    }

    @GetMapping("/{id}/session")
    public ResponseEntity<ApiResponse<ReadingSessionResponse>> getSession(
            @AuthenticationPrincipal UserPrincipal user, @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(library.getSession(user.getId(), id)));
    }

    @PatchMapping("/{id}/session")
    public ResponseEntity<ApiResponse<ReadingSessionResponse>> updateSession(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable Long id,
            @Valid @RequestBody ReadingSessionUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Sesión actualizada",
                library.updateSession(user.getId(), id, request)));
    }
}
