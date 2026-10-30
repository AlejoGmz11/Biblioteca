package com.mylibrary.controller;

import com.mylibrary.dto.ApiResponse;
import com.mylibrary.dto.category.CategoryRequest;
import com.mylibrary.dto.category.CategoryResponse;
import com.mylibrary.security.UserPrincipal;
import com.mylibrary.service.LibraryFacade;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final LibraryFacade library;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CategoryResponse>>> list(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(ApiResponse.ok(library.listCategories(user.getId())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CategoryResponse>> create(@AuthenticationPrincipal UserPrincipal user,
                                                                @Valid @RequestBody CategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Categoría creada", library.createCategory(user.getId(), request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CategoryResponse>> update(@AuthenticationPrincipal UserPrincipal user,
                                                                @PathVariable Long id,
                                                                @Valid @RequestBody CategoryRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Categoría actualizada",
                library.updateCategory(user.getId(), id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@AuthenticationPrincipal UserPrincipal user,
                                                    @PathVariable Long id) {
        library.deleteCategory(user.getId(), id);
        return ResponseEntity.ok(ApiResponse.ok("Categoría eliminada", null));
    }
}
