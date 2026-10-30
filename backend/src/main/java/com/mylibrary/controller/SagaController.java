package com.mylibrary.controller;

import com.mylibrary.dto.ApiResponse;
import com.mylibrary.dto.saga.SagaResponse;
import com.mylibrary.security.UserPrincipal;
import com.mylibrary.service.LibraryFacade;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/sagas")
@RequiredArgsConstructor
public class SagaController {

    private final LibraryFacade library;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SagaResponse>>> list(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(ApiResponse.ok(library.listSagas(user.getId())));
    }
}
