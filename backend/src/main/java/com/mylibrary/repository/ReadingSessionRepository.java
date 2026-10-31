package com.mylibrary.repository;

import com.mylibrary.domain.ReadingSession;
import com.mylibrary.domain.ReadingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReadingSessionRepository extends JpaRepository<ReadingSession, Long> {

    Optional<ReadingSession> findByBookIdAndUserId(Long bookId, Long userId);

    long countByUserIdAndStatus(Long userId, ReadingStatus status);

    @Query("""
            SELECT s FROM ReadingSession s JOIN FETCH s.book
            WHERE s.user.id = :userId AND s.status = :status
            """)
    List<ReadingSession> findAllByUserIdAndStatus(@Param("userId") Long userId, @Param("status") ReadingStatus status);

    @Query("""
            SELECT COALESCE(SUM(b.pages), 0) FROM ReadingSession s JOIN s.book b
            WHERE s.user.id = :userId AND s.status = com.mylibrary.domain.ReadingStatus.FINISHED
            """)
    long sumPagesRead(@Param("userId") Long userId);
}
