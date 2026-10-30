package com.mylibrary.service;

import com.mylibrary.domain.ReadingSession;
import com.mylibrary.domain.ReadingStatus;
import com.mylibrary.dto.session.ReadingSessionResponse;
import com.mylibrary.dto.session.ReadingSessionUpdateRequest;
import com.mylibrary.event.ReadingStatusChangedEvent;
import com.mylibrary.exception.ResourceNotFoundException;
import com.mylibrary.mapper.ReadingSessionMapper;
import com.mylibrary.repository.ReadingSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class ReadingSessionService {

    private final ReadingSessionRepository sessionRepository;
    private final ReadingSessionMapper sessionMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public ReadingSessionResponse get(Long userId, Long bookId) {
        return sessionMapper.toResponse(findSession(userId, bookId));
    }

    @Transactional
    public ReadingSessionResponse update(Long userId, Long bookId, ReadingSessionUpdateRequest request) {
        ReadingSession session = findSession(userId, bookId);
        ReadingStatus previous = session.getStatus();

        if (request.status() != null && request.status() != previous) {
            applyStatusChange(session, request.status());
        }
        if (request.startDate() != null) {
            session.setStartDate(request.startDate());
        }
        if (request.endDate() != null) {
            session.setEndDate(request.endDate());
        }
        if (request.rating() != null) {
            session.setRating(normalizeRating(request.rating()));
        }
        if (request.notes() != null) {
            session.setNotes(request.notes());
        }
        if (request.currentPage() != null) {
            session.setCurrentPage(request.currentPage());
        }
        if (request.ebookLocation() != null) {
            session.setEbookLocation(request.ebookLocation());
        }

        if (request.status() != null && request.status() != previous) {
            // Observer Pattern: interested parties react without coupling here
            eventPublisher.publishEvent(ReadingStatusChangedEvent.builder()
                    .userId(userId)
                    .bookId(bookId)
                    .bookTitle(session.getBook().getTitle())
                    .previousStatus(previous)
                    .newStatus(request.status())
                    .build());
        }
        return sessionMapper.toResponse(session);
    }

    private void applyStatusChange(ReadingSession session, ReadingStatus newStatus) {
        session.setStatus(newStatus);
        if (newStatus == ReadingStatus.READING && session.getStartDate() == null) {
            session.setStartDate(LocalDate.now());
        }
        if (newStatus == ReadingStatus.FINISHED && session.getEndDate() == null) {
            session.setEndDate(LocalDate.now());
        }
        if (newStatus == ReadingStatus.PENDING) {
            session.setStartDate(null);
            session.setEndDate(null);
            session.setCurrentPage(null);
        }
    }

    /** Redondea al paso de media estrella más cercano (p. ej. 4.3 → 4.5). */
    private static double normalizeRating(double rating) {
        return Math.round(rating * 2) / 2.0;
    }

    private ReadingSession findSession(Long userId, Long bookId) {
        return sessionRepository.findByBookIdAndUserId(bookId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Sesión de lectura no encontrada"));
    }
}
