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
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatsService {

    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final DateTimeFormatter DAY_FORMAT   = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final int MONTHS_BACK = 12;
    private static final int DAYS_BACK   = 365;

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
                .pagesPerMonth(pagesPerMonth(finished))
                .avgDaysPerBook(avgDaysPerBook(finished))
                .ratingDistribution(ratingDistribution(finished))
                .activityDays(activityDays(finished))
                .booksFinishedThisYear(booksFinishedThisYear(finished))
                .build();
    }

    private List<StatsResponse.MonthCount> booksPerMonth(List<ReadingSession> finished) {
        Map<YearMonth, Long> counts = finished.stream()
                .filter(s -> s.getEndDate() != null)
                .collect(Collectors.groupingBy(s -> YearMonth.from(s.getEndDate()), Collectors.counting()));

        return buildMonthSlots(counts);
    }

    private List<StatsResponse.MonthCount> pagesPerMonth(List<ReadingSession> finished) {
        Map<YearMonth, Long> counts = finished.stream()
                .filter(s -> s.getEndDate() != null && s.getBook().getPages() != null)
                .collect(Collectors.groupingBy(
                        s -> YearMonth.from(s.getEndDate()),
                        Collectors.summingLong(s -> s.getBook().getPages())
                ));

        return buildMonthSlots(counts);
    }

    private List<StatsResponse.MonthCount> buildMonthSlots(Map<YearMonth, Long> counts) {
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

    private Map<Integer, Long> ratingDistribution(List<ReadingSession> finished) {
        Map<Integer, Long> dist = new LinkedHashMap<>();
        for (int i = 1; i <= 5; i++) dist.put(i, 0L);
        finished.stream()
                .filter(s -> s.getRating() != null)
                .forEach(s -> {
                    int star = (int) Math.round(s.getRating());
                    star = Math.max(1, Math.min(5, star));
                    dist.merge(star, 1L, Long::sum);
                });
        return dist;
    }

    private List<StatsResponse.DayCount> activityDays(List<ReadingSession> finished) {
        LocalDate today = LocalDate.now();
        LocalDate from  = today.minusDays(DAYS_BACK - 1);

        Map<LocalDate, Long> counts = finished.stream()
                .filter(s -> s.getEndDate() != null && !s.getEndDate().isBefore(from))
                .collect(Collectors.groupingBy(ReadingSession::getEndDate, Collectors.counting()));

        List<StatsResponse.DayCount> result = new ArrayList<>(DAYS_BACK);
        for (long i = DAYS_BACK - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            result.add(StatsResponse.DayCount.builder()
                    .date(day.format(DAY_FORMAT))
                    .count(counts.getOrDefault(day, 0L))
                    .build());
        }
        return result;
    }

    private long booksFinishedThisYear(List<ReadingSession> finished) {
        int year = LocalDate.now().getYear();
        return finished.stream()
                .filter(s -> s.getEndDate() != null && s.getEndDate().getYear() == year)
                .count();
    }

    private double avgDaysPerBook(List<ReadingSession> finished) {
        return finished.stream()
                .filter(s -> s.getStartDate() != null && s.getEndDate() != null)
                .mapToLong(s -> ChronoUnit.DAYS.between(s.getStartDate(), s.getEndDate()) + 1)
                .average()
                .orElse(0.0);
    }
}
