package com.mylibrary.service;

import com.mylibrary.domain.BookType;
import com.mylibrary.domain.ReadingStatus;
import com.mylibrary.dto.PageResponse;
import com.mylibrary.dto.book.BookRequest;
import com.mylibrary.dto.book.BookResponse;
import com.mylibrary.dto.category.CategoryRequest;
import com.mylibrary.dto.category.CategoryResponse;
import com.mylibrary.dto.saga.SagaResponse;
import com.mylibrary.dto.session.ReadingSessionResponse;
import com.mylibrary.dto.session.ReadingSessionUpdateRequest;
import com.mylibrary.dto.stats.StatsResponse;
import com.mylibrary.dto.user.ChangePasswordRequest;
import com.mylibrary.dto.user.UpdateProfileRequest;
import com.mylibrary.dto.user.UserResponse;
import com.mylibrary.service.ebook.EbookOpenResult;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Facade Pattern: single, simplified entry point to the service layer.
 * Controllers depend on this class only, keeping them thin and decoupled from
 * the individual services behind it.
 */
@Service
@RequiredArgsConstructor
public class LibraryFacade {

    private final BookService bookService;
    private final ReadingSessionService sessionService;
    private final CategoryService categoryService;
    private final SagaService sagaService;
    private final StatsService statsService;
    private final ExportService exportService;
    private final ImageService imageService;
    private final EbookService ebookService;
    private final UserService userService;

    // --- Books ---

    public PageResponse<BookResponse> listBooks(Long userId, ReadingStatus status, Long categoryId,
                                                BookType type, String author, String search,
                                                String saga, Pageable pageable) {
        return bookService.list(userId, status, categoryId, type, author, search, saga, pageable);
    }

    public BookResponse getBook(Long userId, Long bookId) {
        return bookService.get(userId, bookId);
    }

    public BookResponse createBook(Long userId, BookRequest request) {
        return bookService.create(userId, request);
    }

    public BookResponse updateBook(Long userId, Long bookId, BookRequest request) {
        return bookService.update(userId, bookId, request);
    }

    public void deleteBook(Long userId, Long bookId) {
        bookService.delete(userId, bookId);
    }

    // --- Reading sessions ---

    public ReadingSessionResponse getSession(Long userId, Long bookId) {
        return sessionService.get(userId, bookId);
    }

    public ReadingSessionResponse updateSession(Long userId, Long bookId, ReadingSessionUpdateRequest request) {
        return sessionService.update(userId, bookId, request);
    }

    // --- Categories ---

    public List<CategoryResponse> listCategories(Long userId) {
        return categoryService.list(userId);
    }

    public CategoryResponse createCategory(Long userId, CategoryRequest request) {
        return categoryService.create(userId, request);
    }

    public CategoryResponse updateCategory(Long userId, Long categoryId, CategoryRequest request) {
        return categoryService.update(userId, categoryId, request);
    }

    public void deleteCategory(Long userId, Long categoryId) {
        categoryService.delete(userId, categoryId);
    }

    // --- Sagas ---

    public List<SagaResponse> listSagas(Long userId) {
        return sagaService.list(userId);
    }

    // --- Stats & export ---

    public StatsResponse dashboard(Long userId) {
        return statsService.dashboard(userId);
    }

    public byte[] exportCsv(Long userId) {
        return exportService.exportCsv(userId);
    }

    public byte[] exportJson(Long userId) {
        return exportService.exportJson(userId);
    }

    // --- Images ---

    public String uploadImage(MultipartFile file) {
        return imageService.upload(file);
    }

    public Resource loadImage(String filename) {
        return imageService.load(filename);
    }

    // --- Ebooks ---

    public BookResponse attachEbook(Long userId, Long bookId, MultipartFile file) {
        return ebookService.attach(userId, bookId, file);
    }

    public BookResponse createBookFromEbook(Long userId, MultipartFile file, String title, String author) {
        return ebookService.createFromFile(userId, file, title, author);
    }

    public EbookOpenResult openEbook(Long userId, Long bookId, String rangeHeader) {
        return ebookService.open(userId, bookId, rangeHeader);
    }

    public BookResponse removeEbook(Long userId, Long bookId) {
        return ebookService.remove(userId, bookId);
    }

    // --- Profile ---

    public UserResponse getProfile(Long userId) {
        return userService.getProfile(userId);
    }

    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        return userService.updateProfile(userId, request);
    }

    public void changePassword(Long userId, ChangePasswordRequest request) {
        userService.changePassword(userId, request);
    }
}
