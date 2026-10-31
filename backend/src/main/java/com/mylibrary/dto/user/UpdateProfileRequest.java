package com.mylibrary.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Builder;

@Builder
public record UpdateProfileRequest(
        @Size(min = 3, max = 50, message = "El nombre de usuario debe tener entre 3 y 50 caracteres")
        String username,

        @Email(message = "El email no es válido")
        String email,

        @Size(max = 500)
        String avatarUrl,

        Integer readingGoal
) {
}
