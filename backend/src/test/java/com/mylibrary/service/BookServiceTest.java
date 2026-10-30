package com.mylibrary.service;

import com.mylibrary.domain.*;
import com.mylibrary.dto.book.BookRequest;
import com.mylibrary.dto.book.BookResponse;
import com.mylibrary.exception.ResourceNotFoundException;
import com.mylibrary.mapper.BookMapper;
import com.mylibrary.repository.BookRepository;
import com.mylibrary.repository.CategoryRepository;
import com.mylibrary.repository.SagaRepository;
import com.mylibrary.service.factory.BookFactory;
import com.mylibrary.service.storage.EbookStorage;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookServiceTest {

    @Mock
    private BookRepository bookRepository;
    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private SagaRepository sagaRepository;
    @Mock
    private BookMapper bookMapper;
    @Mock
    private UserService userService;
    @Mock
    private EntityManager entityManager;
    @Mock
    private EbookStorage ebookStorage;

    private BookService bookService;

    private final User user = User.builder().id(1L).username("ana").email("ana@test.com").password("x").build();

    @BeforeEach
    void setUp() {
        bookService = new BookService(bookRepository, categoryRepository, sagaRepository,
                new BookFactory(), bookMapper, userService, entityManager, ebookStorage);
    }

    @Test
    void createBuildsCorrectSubtypeAndPendingSession() {
        BookRequest request = BookRequest.builder()
                .title("Dune").author("Frank Herbert").type(BookType.PHYSICAL).build();
        when(userService.findUser(1L)).thenReturn(user);
        when(bookRepository.save(any(Book.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bookMapper.toResponse(any(Book.class))).thenReturn(mock(BookResponse.class));

        bookService.create(1L, request);

        ArgumentCaptor<Book> captor = ArgumentCaptor.forClass(Book.class);
        verify(bookRepository).save(captor.capture());
        Book saved = captor.getValue();
        assertThat(saved).isInstanceOf(PhysicalBook.class);
        assertThat(saved.getBookType()).isEqualTo(BookType.PHYSICAL);
        assertThat(saved.getUser()).isEqualTo(user);
        assertThat(saved.getSession()).isNotNull();
        assertThat(saved.getSession().getStatus()).isEqualTo(ReadingStatus.PENDING);
    }

    @Test
    void createResolvesMultipleCategoriesVisibleToUser() {
        Category fiction = Category.builder().id(7L).name("Ficción").predefined(true).build();
        Category sciFi = Category.builder().id(8L).name("Ciencia ficción").predefined(true).build();
        BookRequest request = BookRequest.builder()
                .title("Dune").author("Frank Herbert").type(BookType.DIGITAL)
                .categoryIds(List.of(7L, 8L, 7L)) // el duplicado se ignora
                .build();
        when(userService.findUser(1L)).thenReturn(user);
        when(categoryRepository.findVisibleById(7L, 1L)).thenReturn(Optional.of(fiction));
        when(categoryRepository.findVisibleById(8L, 1L)).thenReturn(Optional.of(sciFi));
        when(bookRepository.save(any(Book.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bookMapper.toResponse(any(Book.class))).thenReturn(mock(BookResponse.class));

        bookService.create(1L, request);

        ArgumentCaptor<Book> captor = ArgumentCaptor.forClass(Book.class);
        verify(bookRepository).save(captor.capture());
        assertThat(captor.getValue().getCategories()).containsExactly(fiction, sciFi);
    }

    @Test
    void createFailsWhenAnyCategoryNotVisible() {
        BookRequest request = BookRequest.builder()
                .title("Dune").author("Frank Herbert").type(BookType.DIGITAL)
                .categoryIds(List.of(99L))
                .build();
        when(userService.findUser(1L)).thenReturn(user);
        when(categoryRepository.findVisibleById(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> bookService.create(1L, request))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void createReusesExistingSagaIgnoringCase() {
        Saga saga = Saga.builder().id(3L).name("Crónicas de Dune").user(user).build();
        BookRequest request = BookRequest.builder()
                .title("Dune").author("Frank Herbert").type(BookType.PHYSICAL)
                .saga("  crónicas de dune ").sagaOrder(1)
                .build();
        when(userService.findUser(1L)).thenReturn(user);
        when(sagaRepository.findByUserIdAndNameIgnoreCase(1L, "crónicas de dune"))
                .thenReturn(Optional.of(saga));
        when(bookRepository.save(any(Book.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bookMapper.toResponse(any(Book.class))).thenReturn(mock(BookResponse.class));

        bookService.create(1L, request);

        ArgumentCaptor<Book> captor = ArgumentCaptor.forClass(Book.class);
        verify(bookRepository).save(captor.capture());
        assertThat(captor.getValue().getSaga()).isEqualTo(saga);
        verify(sagaRepository, never()).save(any(Saga.class));
    }

    @Test
    void createWithNewSagaNameCreatesIt() {
        BookRequest request = BookRequest.builder()
                .title("Dune").author("Frank Herbert").type(BookType.PHYSICAL)
                .saga("Nueva saga")
                .build();
        when(userService.findUser(1L)).thenReturn(user);
        when(sagaRepository.findByUserIdAndNameIgnoreCase(1L, "Nueva saga")).thenReturn(Optional.empty());
        when(sagaRepository.save(any(Saga.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bookRepository.save(any(Book.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bookMapper.toResponse(any(Book.class))).thenReturn(mock(BookResponse.class));

        bookService.create(1L, request);

        verify(sagaRepository).save(any(Saga.class));
    }

    @Test
    void deleteRemovesOrphanSaga() {
        Saga saga = Saga.builder().id(3L).name("Solitaria").user(user).build();
        Book existing = PhysicalBook.builder().id(5L).title("Único").author("Autor")
                .user(user).saga(saga).build();
        when(bookRepository.findByIdAndUserId(5L, 1L)).thenReturn(Optional.of(existing));
        when(bookRepository.countBySagaId(3L)).thenReturn(0L);

        bookService.delete(1L, 5L);

        verify(bookRepository).delete(existing);
        verify(sagaRepository).delete(saga);
    }

    @Test
    void updateChangesBookTypeThroughDiscriminator() {
        Book physical = PhysicalBook.builder().id(5L).title("Dune").author("Herbert").user(user).build();
        Book audio = AudioBook.builder().id(5L).title("Dune").author("Herbert").user(user).build();
        // Primera carga: subtipo original; tras actualizar el discriminador se recarga como AudioBook
        when(bookRepository.findByIdAndUserId(5L, 1L))
                .thenReturn(Optional.of(physical), Optional.of(audio));
        when(bookMapper.toResponse(any(Book.class))).thenReturn(mock(BookResponse.class));
        BookRequest request = BookRequest.builder()
                .title("Dune").author("Herbert").type(BookType.AUDIOBOOK).build();

        bookService.update(1L, 5L, request);

        verify(bookRepository).updateDiscriminator(5L, "AUDIOBOOK");
        verify(entityManager).clear();
        verify(bookMapper).apply(same(audio), any(BookRequest.class));
    }

    @Test
    void updateWithSameTypeDoesNotTouchDiscriminator() {
        Book existing = PhysicalBook.builder().id(5L).title("Dune").author("Herbert").user(user).build();
        when(bookRepository.findByIdAndUserId(5L, 1L)).thenReturn(Optional.of(existing));
        when(bookMapper.toResponse(any(Book.class))).thenReturn(mock(BookResponse.class));
        BookRequest request = BookRequest.builder()
                .title("Dune").author("Herbert").type(BookType.PHYSICAL).build();

        bookService.update(1L, 5L, request);

        verify(bookRepository, never()).updateDiscriminator(anyLong(), any());
    }

    @Test
    void getThrowsWhenBookBelongsToAnotherUser() {
        when(bookRepository.findByIdAndUserId(anyLong(), anyLong())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> bookService.get(1L, 42L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void deleteRemovesOwnedBook() {
        Book existing = DigitalBook.builder().id(5L).title("Dune").author("Herbert").user(user).build();
        when(bookRepository.findByIdAndUserId(5L, 1L)).thenReturn(Optional.of(existing));

        bookService.delete(1L, 5L);

        verify(bookRepository).delete(existing);
    }
}
