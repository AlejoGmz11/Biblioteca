package com.mylibrary.dto.session;

import com.mylibrary.domain.ReadingStatus;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Builder
public record ReadingSessionResponse(
        Long id,
        Long bookId,
        ReadingStatus status,
        LocalDate startDate,
        LocalDate endDate,
        Double rating,
        String notes,
        Integer currentPage,
        String ebookLocation,
        LocalDateTime createdAt
) {
}
