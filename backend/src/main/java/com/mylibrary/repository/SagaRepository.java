package com.mylibrary.repository;

import com.mylibrary.domain.Saga;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SagaRepository extends JpaRepository<Saga, Long> {

    interface SagaSummary {
        Long getId();

        String getName();

        long getBookCount();
    }

    @Query("""
            SELECT s.id AS id, s.name AS name, COUNT(b.id) AS bookCount
            FROM Saga s LEFT JOIN Book b ON b.saga = s
            WHERE s.user.id = :userId
            GROUP BY s.id, s.name
            ORDER BY s.name
            """)
    List<SagaSummary> findSummariesByUserId(@Param("userId") Long userId);

    Optional<Saga> findByUserIdAndNameIgnoreCase(Long userId, String name);
}
