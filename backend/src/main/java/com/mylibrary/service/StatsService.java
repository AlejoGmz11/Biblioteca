package com.mylibrary.service;

import com.mylibrary.domain.ReadingSession;
import com.mylibrary.domain.ReadingStatus;
import com.mylibrary.dto.stats.StatsResponse;
import com.mylibrary.repository.BookRepository;
import com.mylibrary.repository.ReadingSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatsService {

    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final int MONTHS_BACK = 12;

    private final BookRepository bookRepository;
    private final ReadingSessionRepository sessionRepository;

    @Transactional(readOnly = true)
    public StatsResponse dashboard(Long userId) {
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (ReadingStatus status : ReadingStatus.values()) {
            byStatus.put(status.name(), sessionRepository.countByUserIdAndStatus(userId, status));
        }

        List<ReadingSession> finished =
                sessionRepository.findAllByUserIdAndStatus(userId, ReadingStatus.FINISHED);

        return StatsResponse.builder()
                .totalBooks(bookRepository.countByUserId(userId))
                .booksByStatus(byStatus)
                .totalPagesRead(sessionRepository.sumPagesRead(userId))
                .booksPerMonth(booksPerMonth(finished))
                .avgDaysPerBook(avgDaysPerBook(finished))
                .build();
    }

    private List<StatsResponse.MonthCount> booksPerMonth(List<ReadingSession> finished) {
        Map<YearMonth, Long> counts = finished.stream()
                .filter(s -> s.getEndDate() != null)
                .collect(Collectors.groupingBy(s -> YearMonth.from(s.getEndDate()), Collectors.counting()));

        YearMonth current = YearMonth.from(LocalDate.now());
        List<StatsResponse.MonthCount> result = new ArrayList<>(MONTHS_BACK);
        for (int i = MONTHS_BACK - 1; i >= 0; i--) {
            YearMonth month = current.minusMonths(i);
            result.add(StatsResponse.MonthCount.builder()
                    .month(month.format(MONTH_FORMAT))
                    .count(counts.getOrDefault(month, 0L))
                    .build());
        }
        return result;
    }

    private double avgDaysPerBook(List<ReadingSession> finished) {
        return finished.stream()
                .filter(s -> s.getStartDate() != null && s.getEndDate() != null)
                .mapToLong(s -> ChronoUnit.DAYS.between(s.getStartDate(), s.getEndDate()) + 1)
                .average()
                .orElse(0.0);
    }
}
