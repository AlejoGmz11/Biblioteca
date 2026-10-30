package com.mylibrary.mapper;

import com.mylibrary.domain.ReadingSession;
import com.mylibrary.dto.session.ReadingSessionResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper
public interface ReadingSessionMapper {

    @Mapping(target = "bookId", source = "book.id")
    ReadingSessionResponse toResponse(ReadingSession session);
}
