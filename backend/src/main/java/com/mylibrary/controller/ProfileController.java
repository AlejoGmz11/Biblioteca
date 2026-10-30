package com.mylibrary.controller;

import com.mylibrary.dto.ApiResponse;
import com.mylibrary.dto.user.ChangePasswordRequest;
import com.mylibrary.dto.user.UpdateProfileRequest;
import com.mylibrary.dto.user.UserResponse;
import com.mylibrary.security.UserPrincipal;
import com.mylibrary.service.LibraryFacade;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final LibraryFacade library;

    @GetMapping
    public ResponseEntity<ApiResponse<UserResponse>> get(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(ApiResponse.ok(library.getProfile(user.getId())));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<UserResponse>> update(@AuthenticationPrincipal UserPrincipal user,
                                                            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Perfil actualizado",
                library.updateProfile(user.getId(), request)));
    }

    @PatchMapping("/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody ChangePasswordRequest request) {
        library.changePassword(user.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Contraseña actualizada", null));
    }
}
