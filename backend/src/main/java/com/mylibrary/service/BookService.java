package com.mylibrary.service;

import com.mylibrary.domain.Book;
import com.mylibrary.domain.BookType;
import com.mylibrary.domain.Category;
import com.mylibrary.domain.ReadingSession;
import com.mylibrary.domain.ReadingStatus;
import com.mylibrary.domain.Saga;
import com.mylibrary.dto.PageResponse;
import com.mylibrary.dto.book.BookRequest;
import com.mylibrary.dto.book.BookResponse;
import com.mylibrary.exception.BadRequestException;
import com.mylibrary.exception.ResourceNotFoundException;
import com.mylibrary.mapper.BookMapper;
import com.mylibrary.repository.BookRepository;
import com.mylibrary.repository.BookSpecifications;
import com.mylibrary.repository.CategoryRepository;
import com.mylibrary.repository.SagaRepository;
import com.mylibrary.service.factory.BookFactory;
import com.mylibrary.service.storage.EbookStorage;
import com.mylibrary.util.TransactionHooks;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class BookService {

    private final BookRepository bookRepository;
    private final CategoryRepository categoryRepository;
    private final SagaRepository sagaRepository;
    private final BookFactory bookFactory;
    private final BookMapper bookMapper;
    private final UserService userService;
    private final EntityManager entityManager;
    private final EbookStorage ebookStorage;

    @Transactional(readOnly = true)
    public PageResponse<BookResponse> list(Long userId,
                                           ReadingStatus status,
                                           Long categoryId,
                                           BookType type,
                                           String author,
                                           String search,
                                           String saga,
                                           Pageable pageable) {
        Specification<Book> spec = BookSpecifications.ownedBy(userId);
        if (status != null) {
            spec = spec.and(BookSpecifications.hasStatus(status));
        }
        if (categoryId != null) {
            spec = spec.and(BookSpecifications.hasCategory(categoryId));
        }
        if (type != null) {
            spec = spec.and(BookSpecifications.hasType(type));
        }
        if (saga != null && !saga.isBlank()) {
            // "none" = solo autoconclusivos; cualquier otro valor es el id de la saga
            spec = "none".equalsIgnoreCase(saga)
                    ? spec.and(BookSpecifications.standalone())
                    : spec.and(BookSpecifications.inSaga(parseSagaId(saga)));
        }
        if (author != null && !author.isBlank()) {
            spec = spec.and(BookSpecifications.byAuthor(author));
        }
        if (search != null && !search.isBlank()) {
            spec = spec.and(BookSpecifications.matchesSearch(search));
        }
        return PageResponse.from(bookRepository.findAll(spec, pageable), bookMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public BookResponse get(Long userId, Long bookId) {
        return bookMapper.toResponse(findOwnedBook(userId, bookId));
    }

    @Transactional
    public BookResponse create(Long userId, BookRequest request) {
        Book book = bookFactory.create(request.type());
        bookMapper.apply(book, request);
        book.setUser(userService.findUser(userId));
        book.setCategories(resolveCategories(userId, request.categoryIds()));
        book.setSaga(resolveSaga(userId, request.saga()));
        book.setSession(ReadingSession.builder()
                .book(book)
                .user(book.getUser())
                .status(ReadingStatus.PENDING)
                .build());
        return bookMapper.toResponse(bookRepository.save(book));
    }

    @Transactional
    public BookResponse update(Long userId, Long bookId, BookRequest request) {
        Book book = findOwnedBook(userId, bookId);
        if (request.type() != null && request.type() != book.getBookType()) {
            book = changeType(userId, bookId, request.type());
        }
        bookMapper.apply(book, request);
        book.setCategories(resolveCategories(userId, request.categoryIds()));
        Saga previous = book.getSaga();
        book.setSaga(resolveSaga(userId, request.saga()));
        deleteIfOrphan(previous, book.getSaga());
        return bookMapper.toResponse(book);
    }

    @Transactional
    public void delete(Long userId, Long bookId) {
        Book book = findOwnedBook(userId, bookId);
        Saga saga = book.getSaga();
        String ebookKey = book.getEbookKey();
        bookRepository.delete(book);
        deleteIfOrphan(saga, null);
        if (ebookKey != null) {
            // El archivo se borra solo si el borrado del libro llega a confirmarse
            TransactionHooks.afterCommit(() -> ebookStorage.delete(ebookKey));
        }
    }

    Book findOwnedBook(Long userId, Long bookId) {
        return bookRepository.findByIdAndUserId(bookId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Libro no encontrado"));
    }

    /**
     * Cambia el subtipo del libro: actualiza el discriminador por SQL, limpia
     * el contexto de persistencia y recarga la entidad como su nueva subclase.
     */
    private Book changeType(Long userId, Long bookId, BookType newType) {
        entityManager.flush();
        bookRepository.updateDiscriminator(bookId, newType.name());
        entityManager.clear();
        return findOwnedBook(userId, bookId);
    }

    /** Reutiliza la saga existente del usuario (ignorando mayúsculas) o la crea. */
    private Saga resolveSaga(Long userId, String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        String trimmed = name.trim();
        return sagaRepository.findByUserIdAndNameIgnoreCase(userId, trimmed)
                .orElseGet(() -> sagaRepository.save(Saga.builder()
                        .name(trimmed)
                        .user(userService.findUser(userId))
                        .build()));
    }

    /** Borra la saga anterior si se quedó sin libros tras un cambio o borrado. */
    private void deleteIfOrphan(Saga previous, Saga current) {
        if (previous == null || previous.equals(current)) {
            return;
        }
        if (bookRepository.countBySagaId(previous.getId()) == 0) {
            sagaRepository.delete(previous);
        }
    }

    private static Long parseSagaId(String saga) {
        try {
            return Long.valueOf(saga);
        } catch (NumberFormatException e) {
            throw new BadRequestException("Filtro de saga no válido: " + saga);
        }
    }

    private Set<Category> resolveCategories(Long userId, List<Long> categoryIds) {
        Set<Category> categories = new LinkedHashSet<>();
        if (categoryIds == null) {
            return categories;
        }
        for (Long categoryId : categoryIds.stream().distinct().toList()) {
            categories.add(categoryRepository.findVisibleById(categoryId, userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada: " + categoryId)));
        }
        return categories;
    }
}
