package com.mylibrary.service;

import com.mylibrary.domain.*;
import com.mylibrary.dto.session.ReadingSessionResponse;
import com.mylibrary.dto.session.ReadingSessionUpdateRequest;
import com.mylibrary.event.ReadingStatusChangedEvent;
import com.mylibrary.mapper.ReadingSessionMapper;
import com.mylibrary.repository.ReadingSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReadingSessionServiceTest {

    @Mock
    private ReadingSessionRepository sessionRepository;
    @Mock
    private ReadingSessionMapper sessionMapper;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private ReadingSessionService service;

    private ReadingSession session;

    @BeforeEach
    void setUp() {
        User user = User.builder().id(1L).username("ana").email("a@a.com").password("x").build();
        Book book = PhysicalBook.builder().id(10L).title("Dune").author("Herbert").user(user).build();
        session = ReadingSession.builder().id(100L).book(book).user(user).status(ReadingStatus.PENDING).build();
        lenient().when(sessionRepository.findByBookIdAndUserId(10L, 1L)).thenReturn(Optional.of(session));
        lenient().when(sessionMapper.toResponse(any())).thenReturn(mock(ReadingSessionResponse.class));
    }

    @Test
    void movingToReadingSetsStartDateAndPublishesEvent() {
        service.update(1L, 10L, ReadingSessionUpdateRequest.builder().status(ReadingStatus.READING).build());

        assertThat(session.getStatus()).isEqualTo(ReadingStatus.READING);
        assertThat(session.getStartDate()).isEqualTo(LocalDate.now());

        ArgumentCaptor<ReadingStatusChangedEvent> captor =
                ArgumentCaptor.forClass(ReadingStatusChangedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().previousStatus()).isEqualTo(ReadingStatus.PENDING);
        assertThat(captor.getValue().newStatus()).isEqualTo(ReadingStatus.READING);
    }

    @Test
    void movingToFinishedSetsEndDate() {
        session.setStatus(ReadingStatus.READING);
        session.setStartDate(LocalDate.now().minusDays(5));

        service.update(1L, 10L, ReadingSessionUpdateRequest.builder()
                .status(ReadingStatus.FINISHED).rating(4.5).build());

        assertThat(session.getStatus()).isEqualTo(ReadingStatus.FINISHED);
        assertThat(session.getEndDate()).isEqualTo(LocalDate.now());
        assertThat(session.getRating()).isEqualTo(4.5);
    }

    @Test
    void ratingIsNormalizedToHalfStarSteps() {
        service.update(1L, 10L, ReadingSessionUpdateRequest.builder().rating(4.3).build());
        assertThat(session.getRating()).isEqualTo(4.5);

        service.update(1L, 10L, ReadingSessionUpdateRequest.builder().rating(3.1).build());
        assertThat(session.getRating()).isEqualTo(3.0);
    }

    @Test
    void backToPendingClearsProgress() {
        session.setStatus(ReadingStatus.READING);
        session.setStartDate(LocalDate.now().minusDays(2));
        session.setCurrentPage(120);

        service.update(1L, 10L, ReadingSessionUpdateRequest.builder().status(ReadingStatus.PENDING).build());

        assertThat(session.getStartDate()).isNull();
        assertThat(session.getEndDate()).isNull();
        assertThat(session.getCurrentPage()).isNull();
    }

    @Test
    void noEventWhenStatusUnchanged() {
        service.update(1L, 10L, ReadingSessionUpdateRequest.builder().notes("Muy bueno").build());

        assertThat(session.getNotes()).isEqualTo("Muy bueno");
        verify(eventPublisher, never()).publishEvent(any(ReadingStatusChangedEvent.class));
    }
}
