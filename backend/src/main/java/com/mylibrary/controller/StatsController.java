package com.mylibrary.controller;

import com.mylibrary.dto.ApiResponse;
import com.mylibrary.dto.stats.StatsResponse;
import com.mylibrary.security.UserPrincipal;
import com.mylibrary.service.LibraryFacade;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {

    private final LibraryFacade library;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<StatsResponse>> dashboard(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(ApiResponse.ok(library.dashboard(user.getId())));
    }
}
