package com.mylibrary.service;

import com.mylibrary.domain.PasswordResetToken;
import com.mylibrary.domain.User;
import com.mylibrary.exception.BadRequestException;
import com.mylibrary.repository.PasswordResetTokenRepository;
import com.mylibrary.repository.UserRepository;
import com.mylibrary.service.mail.MailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordResetTokenRepository tokenRepository;
    @Mock
    private MailService mailService;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private PasswordResetService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new PasswordResetService(userRepository, tokenRepository, passwordEncoder, mailService,
                "http://localhost:4200", 30);
        user = User.builder().id(1L).username("ana").email("ana@test.com")
                .password(passwordEncoder.encode("vieja1234")).build();
    }

    @Test
    void requestStoresOnlyTheHashAndEmailsTheRawToken() {
        when(userRepository.findByEmailIgnoreCase("ana@test.com")).thenReturn(Optional.of(user));

        service.requestReset("  ana@test.com ");

        ArgumentCaptor<PasswordResetToken> saved = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokenRepository).save(saved.capture());
        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(mailService).sendPasswordReset(eq("ana@test.com"), eq("ana"), link.capture(), eq(30));

        String rawToken = link.getValue().substring(link.getValue().indexOf("token=") + 6);
        assertThat(link.getValue()).startsWith("http://localhost:4200/reset-password?token=");
        assertThat(rawToken).hasSizeGreaterThan(40);
        // En la BD solo está el hash, y coincide con el token del email
        assertThat(saved.getValue().getTokenHash()).isEqualTo(PasswordResetService.hash(rawToken));
        assertThat(saved.getValue().getTokenHash()).isNotEqualTo(rawToken);
        assertThat(saved.getValue().getExpiresAt()).isAfter(LocalDateTime.now().plusMinutes(29));
        // Los tokens anteriores del usuario se invalidan
        verify(tokenRepository).invalidateAllForUser(eq(1L), any());
    }

    @Test
    void requestForUnknownEmailDoesNothingAndDoesNotFail() {
        when(userRepository.findByEmailIgnoreCase("nadie@test.com")).thenReturn(Optional.empty());

        service.requestReset("nadie@test.com");

        verify(tokenRepository, never()).save(any());
        verify(mailService, never()).sendPasswordReset(any(), any(), any(), anyInt());
    }

    @Test
    void resetWithValidTokenChangesPasswordAndConsumesToken() {
        String raw = PasswordResetService.generateToken();
        PasswordResetToken token = PasswordResetToken.builder().user(user)
                .tokenHash(PasswordResetService.hash(raw))
                .expiresAt(LocalDateTime.now().plusMinutes(10)).build();
        when(tokenRepository.findByTokenHash(PasswordResetService.hash(raw))).thenReturn(Optional.of(token));

        service.resetPassword(raw, "nueva5678");

        assertThat(passwordEncoder.matches("nueva5678", user.getPassword())).isTrue();
        assertThat(passwordEncoder.matches("vieja1234", user.getPassword())).isFalse();
        assertThat(token.isUsed()).isTrue();
    }

    @Test
    void resetRejectsUnknownToken() {
        when(tokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resetPassword("inventado", "nueva5678"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("no es válido");
    }

    @Test
    void resetRejectsExpiredToken() {
        String raw = PasswordResetService.generateToken();
        PasswordResetToken token = PasswordResetToken.builder().user(user)
                .tokenHash(PasswordResetService.hash(raw))
                .expiresAt(LocalDateTime.now().minusMinutes(1)).build();
        when(tokenRepository.findByTokenHash(PasswordResetService.hash(raw))).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service.resetPassword(raw, "nueva5678"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("caducado");
        assertThat(passwordEncoder.matches("vieja1234", user.getPassword())).isTrue();
    }

    @Test
    void resetRejectsAlreadyUsedToken() {
        String raw = PasswordResetService.generateToken();
        PasswordResetToken token = PasswordResetToken.builder().user(user)
                .tokenHash(PasswordResetService.hash(raw))
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .usedAt(LocalDateTime.now().minusMinutes(1)).build();
        when(tokenRepository.findByTokenHash(PasswordResetService.hash(raw))).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service.resetPassword(raw, "nueva5678"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ya se ha utilizado");
    }

    @Test
    void tokensAreRandomAndUrlSafe() {
        String a = PasswordResetService.generateToken();
        String b = PasswordResetService.generateToken();

        assertThat(a).isNotEqualTo(b);
        assertThat(a).matches("[A-Za-z0-9_-]{43}");
    }
}
