package com.mylibrary.dto.book;

import com.mylibrary.domain.BookType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Builder;

import java.util.List;

@Builder
public record BookRequest(
        @NotBlank(message = "El título es obligatorio")
        @Size(max = 255)
        String title,

        @NotBlank(message = "El autor es obligatorio")
        @Size(max = 255)
        String author,

        @Size(max = 20, message = "El ISBN no puede superar 20 caracteres")
        String isbn,

        @Min(value = 1, message = "Las páginas deben ser al menos 1")
        @Max(value = 100000, message = "Número de páginas no válido")
        Integer pages,

        List<Long> categoryIds,

        /** Nombre de la saga/trilogía; null o vacío si es autoconclusivo. */
        @Size(max = 255)
        String saga,

        @Min(value = 1, message = "La posición en la saga debe ser al menos 1")
        @Max(value = 100, message = "Posición en la saga no válida")
        Integer sagaOrder,

        @NotNull(message = "El tipo de libro es obligatorio")
        BookType type,

        @Size(max = 500)
        String imageUrl,

        @Size(max = 500)
        String imagePath,

        @Size(max = 5000)
        String description
) {
}
