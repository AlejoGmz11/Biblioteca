package com.mylibrary.mapper;

import com.mylibrary.domain.User;
import com.mylibrary.dto.user.UserResponse;
import org.mapstruct.Mapper;

@Mapper
public interface UserMapper {

    UserResponse toResponse(User user);
}
