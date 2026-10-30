package com.mylibrary.mapper;

import com.mylibrary.domain.Book;
import com.mylibrary.dto.book.BookRequest;
import com.mylibrary.dto.book.BookResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper(uses = {CategoryMapper.class, ReadingSessionMapper.class})
public interface BookMapper {

    @Mapping(target = "type", expression = "java(book.getBookType())")
    @Mapping(target = "sagaId", source = "saga.id")
    @Mapping(target = "sagaName", source = "saga.name")
    BookResponse toResponse(Book book);

    /**
     * Copies the scalar fields of the request onto an entity created by the
     * BookFactory. Category and ownership are resolved in the service layer.
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "categories", ignore = true)
    @Mapping(target = "saga", ignore = true)
    @Mapping(target = "ebookKey", ignore = true)
    @Mapping(target = "ebookFormat", ignore = true)
    @Mapping(target = "ebookSize", ignore = true)
    @Mapping(target = "type", ignore = true)
    @Mapping(target = "user", ignore = true)
    @Mapping(target = "session", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void apply(@MappingTarget Book book, BookRequest request);
}
