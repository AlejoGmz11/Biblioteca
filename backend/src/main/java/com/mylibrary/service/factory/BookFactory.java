package com.mylibrary.service.factory;

import com.mylibrary.domain.AudioBook;
import com.mylibrary.domain.Book;
import com.mylibrary.domain.BookType;
import com.mylibrary.domain.DigitalBook;
import com.mylibrary.domain.PhysicalBook;
import com.mylibrary.exception.BadRequestException;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Factory Pattern: creates the concrete Book subtype for a given BookType.
 * New types only require a new entry in the registry (Open/Closed).
 */
@Component
public class BookFactory {

    private final Map<BookType, Supplier<Book>> registry = new EnumMap<>(BookType.class);

    public BookFactory() {
        registry.put(BookType.PHYSICAL, PhysicalBook::new);
        registry.put(BookType.DIGITAL, DigitalBook::new);
        registry.put(BookType.AUDIOBOOK, AudioBook::new);
    }

    public Book create(BookType type) {
        Supplier<Book> supplier = registry.get(type);
        if (supplier == null) {
            throw new BadRequestException("Tipo de libro no soportado: " + type);
        }
        return supplier.get();
    }
}
