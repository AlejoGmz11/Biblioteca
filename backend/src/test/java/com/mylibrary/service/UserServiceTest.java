package com.mylibrary.service;

import com.mylibrary.domain.User;
import com.mylibrary.dto.user.ChangePasswordRequest;
import com.mylibrary.exception.BadRequestException;
import com.mylibrary.mapper.UserMapper;
import com.mylibrary.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private UserMapper userMapper;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private UserService userService;
    private User user;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, userMapper, passwordEncoder);
        user = User.builder()
                .id(1L)
                .username("ana")
                .email("ana@test.com")
                .password(passwordEncoder.encode("actual123"))
                .build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
    }

    @Test
    void changePasswordStoresANewEncodedPassword() {
        String previousHash = user.getPassword();

        userService.changePassword(1L, ChangePasswordRequest.builder()
                .currentPassword("actual123")
                .newPassword("nueva4567")
                .build());

        assertThat(user.getPassword()).isNotEqualTo(previousHash);
        assertThat(user.getPassword()).doesNotContain("nueva4567");
        assertThat(passwordEncoder.matches("nueva4567", user.getPassword())).isTrue();
    }

    @Test
    void changePasswordRejectsWrongCurrentPassword() {
        String previousHash = user.getPassword();

        assertThatThrownBy(() -> userService.changePassword(1L, ChangePasswordRequest.builder()
                .currentPassword("incorrecta")
                .newPassword("nueva4567")
                .build()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("actual no es correcta");
        assertThat(user.getPassword()).isEqualTo(previousHash);
    }

    @Test
    void changePasswordRejectsReusingTheSamePassword() {
        assertThatThrownBy(() -> userService.changePassword(1L, ChangePasswordRequest.builder()
                .currentPassword("actual123")
                .newPassword("actual123")
                .build()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("distinta");
    }
}
