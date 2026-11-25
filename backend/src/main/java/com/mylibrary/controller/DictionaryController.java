package com.mylibrary.controller;

import com.mylibrary.dto.ApiResponse;
import com.mylibrary.dto.dictionary.DictionaryEntryResponse;
import com.mylibrary.service.dictionary.DictionaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Definiciones para el lector. Requiere sesión, como el resto de la API. */
@RestController
@RequestMapping("/api/dictionary")
@RequiredArgsConstructor
public class DictionaryController {

    private final DictionaryService dictionary;

    @GetMapping("/{word}")
    public ResponseEntity<ApiResponse<DictionaryEntryResponse>> lookup(@PathVariable String word) {
        return ResponseEntity.ok(ApiResponse.ok(dictionary.lookup(word)));
    }
}
