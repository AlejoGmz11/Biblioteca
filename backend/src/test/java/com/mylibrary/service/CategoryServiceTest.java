package com.mylibrary.service;

import com.mylibrary.domain.Category;
import com.mylibrary.dto.category.CategoryRequest;
import com.mylibrary.exception.ForbiddenOperationException;
import com.mylibrary.mapper.CategoryMapper;
import com.mylibrary.repository.BookRepository;
import com.mylibrary.repository.CategoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryServiceTest {

    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private BookRepository bookRepository;
    @Mock
    private UserService userService;

    private final CategoryMapper mapper = Mappers.getMapper(CategoryMapper.class);

    @Test
    void predefinedCategoriesCannotBeDeleted() {
        CategoryService service = new CategoryService(categoryRepository, bookRepository, mapper, userService);
        Category predefined = Category.builder().id(1L).name("Ficción").predefined(true).build();
        when(categoryRepository.findVisibleById(1L, 1L)).thenReturn(Optional.of(predefined));

        assertThatThrownBy(() -> service.delete(1L, 1L))
                .isInstanceOf(ForbiddenOperationException.class)
                .hasMessageContaining("predefinidas");
        verify(categoryRepository, never()).delete(any());
    }

    @Test
    void categoryWithBooksCannotBeDeleted() {
        CategoryService service = new CategoryService(categoryRepository, bookRepository, mapper, userService);
        Category own = Category.builder().id(2L).name("Mis clásicos").predefined(false).build();
        when(categoryRepository.findVisibleById(2L, 1L)).thenReturn(Optional.of(own));
        when(bookRepository.existsByCategoriesIdAndUserId(2L, 1L)).thenReturn(true);

        assertThatThrownBy(() -> service.delete(1L, 2L))
                .isInstanceOf(ForbiddenOperationException.class);
        verify(categoryRepository, never()).delete(any());
    }

    @Test
    void predefinedCategoriesCannotBeUpdated() {
        CategoryService service = new CategoryService(categoryRepository, bookRepository, mapper, userService);
        Category predefined = Category.builder().id(1L).name("Ficción").predefined(true).build();
        when(categoryRepository.findVisibleById(1L, 1L)).thenReturn(Optional.of(predefined));

        assertThatThrownBy(() -> service.update(1L, 1L,
                CategoryRequest.builder().name("Otro").build()))
                .isInstanceOf(ForbiddenOperationException.class);
    }
}
