package com.mylibrary.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mylibrary.domain.Book;
import com.mylibrary.domain.Category;
import com.mylibrary.domain.ReadingSession;
import com.mylibrary.mapper.BookMapper;
import com.mylibrary.repository.BookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExportService {

    private static final String CSV_HEADER =
            "id,title,author,isbn,pages,type,categories,saga,sagaOrder,status,startDate,endDate,rating,currentPage,notes";

    private final BookRepository bookRepository;
    private final BookMapper bookMapper;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public byte[] exportCsv(Long userId) {
        List<Book> books = bookRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
        StringBuilder sb = new StringBuilder(CSV_HEADER).append('\n');
        for (Book book : books) {
            ReadingSession s = book.getSession();
            sb.append(csv(book.getId()))
                    .append(',').append(csv(book.getTitle()))
                    .append(',').append(csv(book.getAuthor()))
                    .append(',').append(csv(book.getIsbn()))
                    .append(',').append(csv(book.getPages()))
                    .append(',').append(csv(book.getBookType()))
                    .append(',').append(csv(book.getCategories().stream()
                            .map(Category::getName)
                            .collect(Collectors.joining("; "))))
                    .append(',').append(csv(book.getSaga() == null ? null : book.getSaga().getName()))
                    .append(',').append(csv(book.getSagaOrder()))
                    .append(',').append(csv(s == null ? null : s.getStatus()))
                    .append(',').append(csv(s == null ? null : s.getStartDate()))
                    .append(',').append(csv(s == null ? null : s.getEndDate()))
                    .append(',').append(csv(s == null ? null : s.getRating()))
                    .append(',').append(csv(s == null ? null : s.getCurrentPage()))
                    .append(',').append(csv(s == null ? null : s.getNotes()))
                    .append('\n');
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public byte[] exportJson(Long userId) {
        var books = bookRepository.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(bookMapper::toResponse)
                .toList();
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(books);
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException("No se pudo generar el JSON de exportación", e);
        }
    }

    private String csv(Object value) {
        if (value == null) {
            return "";
        }
        String text = value.toString();
        if (text.contains(",") || text.contains("\"") || text.contains("\n")) {
            return '"' + text.replace("\"", "\"\"") + '"';
        }
        return text;
    }
}
