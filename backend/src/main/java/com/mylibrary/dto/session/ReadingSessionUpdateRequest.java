package com.mylibrary.dto.session;

import com.mylibrary.domain.ReadingStatus;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Builder;

import java.time.LocalDate;

/** PATCH payload: every field is optional, only non-null values are applied. */
@Builder
public record ReadingSessionUpdateRequest(
        ReadingStatus status,

        LocalDate startDate,

        LocalDate endDate,

        @DecimalMin(value = "0.5", message = "La valoración mínima es media estrella")
        @DecimalMax(value = "5.0", message = "La valoración máxima es 5")
        Double rating,

        @Size(max = 10000)
        String notes,

        @Min(value = 0, message = "La página actual no puede ser negativa")
        Integer currentPage,

        /** Ubicación de lectura EPUB (CFI). */
        @Size(max = 1000)
        String ebookLocation
) {
}
