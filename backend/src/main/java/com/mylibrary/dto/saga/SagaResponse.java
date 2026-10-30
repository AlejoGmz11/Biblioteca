package com.mylibrary.dto.saga;

import lombok.Builder;

@Builder
public record SagaResponse(
        Long id,
        String name,
        long bookCount
) {
}
