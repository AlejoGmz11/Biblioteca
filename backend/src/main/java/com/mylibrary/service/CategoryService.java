package com.mylibrary.service;

import com.mylibrary.domain.Category;
import com.mylibrary.dto.category.CategoryRequest;
import com.mylibrary.dto.category.CategoryResponse;
import com.mylibrary.exception.ForbiddenOperationException;
import com.mylibrary.exception.ResourceNotFoundException;
import com.mylibrary.mapper.CategoryMapper;
import com.mylibrary.repository.BookRepository;
import com.mylibrary.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final BookRepository bookRepository;
    private final CategoryMapper categoryMapper;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<CategoryResponse> list(Long userId) {
        return categoryRepository.findAllVisibleTo(userId).stream()
                .map(categoryMapper::toResponse)
                .toList();
    }

    @Transactional
    public CategoryResponse create(Long userId, CategoryRequest request) {
        Category category = categoryMapper.toEntity(request);
        category.setUser(userService.findUser(userId));
        category.setPredefined(false);
        return categoryMapper.toResponse(categoryRepository.save(category));
    }

    @Transactional
    public CategoryResponse update(Long userId, Long categoryId, CategoryRequest request) {
        Category category = findOwnedCategory(userId, categoryId);
        categoryMapper.update(category, request);
        return categoryMapper.toResponse(category);
    }

    @Transactional
    public void delete(Long userId, Long categoryId) {
        Category category = findOwnedCategory(userId, categoryId);
        if (bookRepository.existsByCategoriesIdAndUserId(categoryId, userId)) {
            throw new ForbiddenOperationException(
                    "No se puede eliminar una categoría con libros asociados");
        }
        categoryRepository.delete(category);
    }

    private Category findOwnedCategory(Long userId, Long categoryId) {
        Category category = categoryRepository.findVisibleById(categoryId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada"));
        if (category.isPredefined()) {
            throw new ForbiddenOperationException("Las categorías predefinidas no se pueden modificar ni eliminar");
        }
        return category;
    }
}
