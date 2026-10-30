package com.mylibrary.controller;

import com.mylibrary.security.UserPrincipal;
import com.mylibrary.service.LibraryFacade;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {

    private final LibraryFacade library;

    @GetMapping("/csv")
    public ResponseEntity<byte[]> exportCsv(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"mylibrary-export.csv\"")
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(library.exportCsv(user.getId()));
    }

    @GetMapping("/json")
    public ResponseEntity<byte[]> exportJson(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"mylibrary-export.json\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(library.exportJson(user.getId()));
    }
}
