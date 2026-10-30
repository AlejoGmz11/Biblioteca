package com.mylibrary.mapper;

import com.mylibrary.domain.Category;
import com.mylibrary.dto.category.CategoryRequest;
import com.mylibrary.dto.category.CategoryResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper
public interface CategoryMapper {

    CategoryResponse toResponse(Category category);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "predefined", ignore = true)
    @Mapping(target = "user", ignore = true)
    Category toEntity(CategoryRequest request);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "predefined", ignore = true)
    @Mapping(target = "user", ignore = true)
    void update(@MappingTarget Category category, CategoryRequest request);
}
