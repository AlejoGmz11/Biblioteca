package com.mylibrary.service;

import com.mylibrary.dto.saga.SagaResponse;
import com.mylibrary.repository.SagaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SagaService {

    private final SagaRepository sagaRepository;

    @Transactional(readOnly = true)
    public List<SagaResponse> list(Long userId) {
        return sagaRepository.findSummariesByUserId(userId).stream()
                .map(s -> SagaResponse.builder()
                        .id(s.getId())
                        .name(s.getName())
                        .bookCount(s.getBookCount())
                        .build())
                .toList();
    }
}
