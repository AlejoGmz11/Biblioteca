package com.mylibrary.dto.auth;

import com.mylibrary.dto.user.UserResponse;
import lombok.Builder;

@Builder
public record AuthResponse(
        String accessToken,
        String refreshToken,
        UserResponse user
) {
}
