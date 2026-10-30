package com.mylibrary.service;

import com.mylibrary.domain.User;
import com.mylibrary.dto.auth.AuthResponse;
import com.mylibrary.dto.auth.LoginRequest;
import com.mylibrary.dto.auth.RegisterRequest;
import com.mylibrary.dto.user.UserResponse;
import com.mylibrary.exception.DuplicateResourceException;
import com.mylibrary.mapper.UserMapper;
import com.mylibrary.repository.UserRepository;
import com.mylibrary.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private JwtService jwtService;
    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private AuthService authService;

    @Test
    void registerEncodesPasswordAndReturnsTokens() {
        RegisterRequest request = RegisterRequest.builder()
                .username("ana").email("ana@test.com").password("secret123").build();
        when(userRepository.existsByUsername("ana")).thenReturn(false);
        when(userRepository.existsByEmail("ana@test.com")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("$2a$hash");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(1L);
            return u;
        });
        when(jwtService.generateAccessToken(1L, "ana")).thenReturn("access-token");
        when(jwtService.generateRefreshToken(1L, "ana")).thenReturn("refresh-token");
        when(userMapper.toResponse(any(User.class))).thenReturn(mock(UserResponse.class));

        AuthResponse response = authService.register(request);

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isEqualTo("refresh-token");
        verify(passwordEncoder).encode("secret123");
    }

    @Test
    void registerRejectsDuplicateUsername() {
        when(userRepository.existsByUsername("ana")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(
                RegisterRequest.builder().username("ana").email("a@a.com").password("secret123").build()))
                .isInstanceOf(DuplicateResourceException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    void loginDelegatesToAuthenticationManager() {
        User user = User.builder().id(1L).username("ana").email("a@a.com").password("hash").build();
        when(userRepository.findByUsername("ana")).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(1L, "ana")).thenReturn("at");
        when(jwtService.generateRefreshToken(1L, "ana")).thenReturn("rt");
        when(userMapper.toResponse(user)).thenReturn(mock(UserResponse.class));

        AuthResponse response = authService.login(
                LoginRequest.builder().username("ana").password("secret123").build());

        assertThat(response.accessToken()).isEqualTo("at");
        verify(authenticationManager).authenticate(any());
    }
}
