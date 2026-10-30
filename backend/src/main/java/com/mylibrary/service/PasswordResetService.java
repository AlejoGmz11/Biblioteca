package com.mylibrary.service;

import com.mylibrary.domain.PasswordResetToken;
import com.mylibrary.domain.User;
import com.mylibrary.exception.BadRequestException;
import com.mylibrary.repository.PasswordResetTokenRepository;
import com.mylibrary.repository.UserRepository;
import com.mylibrary.service.mail.MailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Recuperación de contraseña por email.
 *
 * <ol>
 *   <li>El usuario pide el enlace con su email. La respuesta es la misma exista
 *       o no la cuenta, para no revelar qué emails están registrados.</li>
 *   <li>Se genera un token aleatorio (256 bits) y se guarda solo su hash
 *       SHA-256, con caducidad. El token en claro viaja únicamente en el email.</li>
 *   <li>Con el enlace, el usuario elige la contraseña nueva: se hashea el token
 *       recibido, se comprueba que existe, no ha caducado ni se ha usado, y se
 *       actualiza la contraseña. El token queda consumido.</li>
 * </ol>
 */
@Service
@Slf4j
public class PasswordResetService {

    private static final int TOKEN_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final String frontendUrl;
    private final int expirationMinutes;

    public PasswordResetService(UserRepository userRepository,
                                PasswordResetTokenRepository tokenRepository,
                                PasswordEncoder passwordEncoder,
                                MailService mailService,
                                @Value("${app.frontend-url}") String frontendUrl,
                                @Value("${app.password-reset.token-expiration-minutes}") int expirationMinutes) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.frontendUrl = frontendUrl;
        this.expirationMinutes = expirationMinutes;
    }

    /** Paso 1: si el email existe, envía el enlace. Nunca revela si existe. */
    @Transactional
    public void requestReset(String email) {
        userRepository.findByEmailIgnoreCase(email.trim()).ifPresentOrElse(
                this::issueTokenAndSend,
                () -> log.info("Solicitud de recuperación para un email no registrado (ignorada)"));
    }

    /** Paso 2: valida el token y cambia la contraseña. */
    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        PasswordResetToken token = tokenRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new BadRequestException("El enlace no es válido"));
        if (token.isUsed()) {
            throw new BadRequestException("Este enlace ya se ha utilizado. Solicita uno nuevo");
        }
        if (token.isExpired()) {
            throw new BadRequestException("El enlace ha caducado. Solicita uno nuevo");
        }
        User user = token.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        token.setUsedAt(LocalDateTime.now());
        log.info("Contraseña restablecida para el usuario {}", user.getUsername());
    }

    private void issueTokenAndSend(User user) {
        // Un enlace nuevo invalida los anteriores
        tokenRepository.invalidateAllForUser(user.getId(), LocalDateTime.now());

        String rawToken = generateToken();
        tokenRepository.save(PasswordResetToken.builder()
                .user(user)
                .tokenHash(hash(rawToken))
                .expiresAt(LocalDateTime.now().plusMinutes(expirationMinutes))
                .build());

        String link = UriComponentsBuilder.fromUriString(frontendUrl)
                .path("/reset-password")
                .queryParam("token", rawToken)
                .build()
                .toUriString();
        mailService.sendPasswordReset(user.getEmail(), user.getUsername(), link, expirationMinutes);
    }

    /** 256 bits aleatorios en base64url: seguro para viajar en una URL. */
    static String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** SHA-256 en hexadecimal: lo único que se guarda en base de datos. */
    static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
