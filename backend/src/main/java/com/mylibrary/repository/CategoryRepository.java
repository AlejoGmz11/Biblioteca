package com.mylibrary.repository;

import com.mylibrary.domain.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    /** Predefined (global) categories plus the ones owned by the user. */
    @Query("SELECT c FROM Category c WHERE c.predefined = true OR c.user.id = :userId ORDER BY c.name")
    List<Category> findAllVisibleTo(@Param("userId") Long userId);

    @Query("SELECT c FROM Category c WHERE c.id = :id AND (c.predefined = true OR c.user.id = :userId)")
    Optional<Category> findVisibleById(@Param("id") Long id, @Param("userId") Long userId);

    Optional<Category> findByIdAndUserId(Long id, Long userId);
}
