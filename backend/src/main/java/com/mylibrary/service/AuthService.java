package com.mylibrary.service;

import com.mylibrary.domain.User;
import com.mylibrary.dto.auth.AuthResponse;
import com.mylibrary.dto.auth.LoginRequest;
import com.mylibrary.dto.auth.RefreshTokenRequest;
import com.mylibrary.dto.auth.RegisterRequest;
import com.mylibrary.dto.user.UserResponse;
import com.mylibrary.exception.DuplicateResourceException;
import com.mylibrary.exception.ResourceNotFoundException;
import com.mylibrary.mapper.UserMapper;
import com.mylibrary.repository.UserRepository;
import com.mylibrary.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserMapper userMapper;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new DuplicateResourceException("El nombre de usuario ya está en uso");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new DuplicateResourceException("El email ya está registrado");
        }
        User user = User.builder()
                .username(request.username())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .build();
        user = userRepository.save(user);
        return buildAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new BadCredentialsException("Credenciales incorrectas"));
        return buildAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse refresh(RefreshTokenRequest request) {
        var claims = jwtService.parse(request.refreshToken(), JwtService.TYPE_REFRESH)
                .orElseThrow(() -> new BadCredentialsException("Refresh token no válido o expirado"));
        User user = userRepository.findByUsername(claims.getSubject())
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        return buildAuthResponse(user);
    }

    private AuthResponse buildAuthResponse(User user) {
        UserResponse userResponse = userMapper.toResponse(user);
        return AuthResponse.builder()
                .accessToken(jwtService.generateAccessToken(user.getId(), user.getUsername()))
                .refreshToken(jwtService.generateRefreshToken(user.getId(), user.getUsername()))
                .user(userResponse)
                .build();
    }
}
