package com.mylibrary.service;

import com.mylibrary.domain.User;
import com.mylibrary.dto.user.ChangePasswordRequest;
import com.mylibrary.dto.user.UpdateProfileRequest;
import com.mylibrary.dto.user.UserResponse;
import com.mylibrary.exception.BadRequestException;
import com.mylibrary.exception.DuplicateResourceException;
import com.mylibrary.exception.ResourceNotFoundException;
import com.mylibrary.mapper.UserMapper;
import com.mylibrary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public UserResponse getProfile(Long userId) {
        return userMapper.toResponse(findUser(userId));
    }

    @Transactional
    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = findUser(userId);
        if (request.username() != null && !request.username().equals(user.getUsername())) {
            if (userRepository.existsByUsername(request.username())) {
                throw new DuplicateResourceException("El nombre de usuario ya está en uso");
            }
            user.setUsername(request.username());
        }
        if (request.email() != null && !request.email().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.email())) {
                throw new DuplicateResourceException("El email ya está registrado");
            }
            user.setEmail(request.email());
        }
        if (request.avatarUrl() != null) {
            user.setAvatarUrl(request.avatarUrl());
        }
        return userMapper.toResponse(user);
    }

    /**
     * Cambia la contraseña previa verificación de la actual. Un fallo se
     * comunica como 400 (no 401) para no confundirse con una sesión expirada:
     * el cliente renovaría el token y cerraría sesión por un simple error al
     * teclear.
     */
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = findUser(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new BadRequestException("La contraseña actual no es correcta");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw new BadRequestException("La nueva contraseña debe ser distinta de la actual");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
    }

    User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
    }
}
