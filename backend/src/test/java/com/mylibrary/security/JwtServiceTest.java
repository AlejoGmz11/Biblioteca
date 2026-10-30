package com.mylibrary.security;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        String secret = Base64.getEncoder().encodeToString(
                "a-very-long-test-secret-key-with-at-least-256-bits!!".getBytes());
        jwtService = new JwtService(new JwtProperties(secret, 60_000, 120_000));
    }

    @Test
    void accessTokenRoundTrip() {
        String token = jwtService.generateAccessToken(42L, "ana");

        Optional<Claims> claims = jwtService.parse(token, JwtService.TYPE_ACCESS);

        assertThat(claims).isPresent();
        assertThat(claims.get().getSubject()).isEqualTo("ana");
        assertThat(claims.get().get("uid", Long.class)).isEqualTo(42L);
    }

    @Test
    void refreshTokenIsRejectedAsAccessToken() {
        String refresh = jwtService.generateRefreshToken(42L, "ana");

        assertThat(jwtService.parse(refresh, JwtService.TYPE_ACCESS)).isEmpty();
        assertThat(jwtService.parse(refresh, JwtService.TYPE_REFRESH)).isPresent();
    }

    @Test
    void tamperedTokenIsRejected() {
        String token = jwtService.generateAccessToken(42L, "ana");
        String[] parts = token.split("\\.");
        String tampered = parts[0] + ".x" + parts[1].substring(1) + "." + parts[2];

        assertThat(jwtService.parse(tampered, JwtService.TYPE_ACCESS)).isEmpty();
    }

    @Test
    void expiredTokenIsRejected() {
        String secret = Base64.getEncoder().encodeToString(
                "a-very-long-test-secret-key-with-at-least-256-bits!!".getBytes());
        JwtService shortLived = new JwtService(new JwtProperties(secret, -1000, -1000));

        String token = shortLived.generateAccessToken(42L, "ana");

        assertThat(shortLived.parse(token, JwtService.TYPE_ACCESS)).isEmpty();
    }
}
