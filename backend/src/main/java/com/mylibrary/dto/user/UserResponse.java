package com.mylibrary.dto.user;

import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record UserResponse(
        Long id,
        String username,
        String email,
        String avatarUrl,
        LocalDateTime createdAt
) {
}
