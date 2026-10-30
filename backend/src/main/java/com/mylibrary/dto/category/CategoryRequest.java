package com.mylibrary.dto.category;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Builder;

@Builder
public record CategoryRequest(
        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 100)
        String name
) {
}
