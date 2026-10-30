package com.mylibrary.dto.book;

import com.mylibrary.domain.BookType;
import com.mylibrary.domain.EbookFormat;
import com.mylibrary.dto.category.CategoryResponse;
import com.mylibrary.dto.session.ReadingSessionResponse;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.List;

@Builder
public record BookResponse(
        Long id,
        String title,
        String author,
        String isbn,
        Integer pages,
        List<CategoryResponse> categories,
        Long sagaId,
        String sagaName,
        Integer sagaOrder,
        BookType type,
        String imageUrl,
        String imagePath,
        String description,
        /** null si el libro no tiene ebook adjunto. */
        EbookFormat ebookFormat,
        Long ebookSize,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        ReadingSessionResponse session
) {
}
