package com.mylibrary.dto.stats;

import lombok.Builder;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Builder
public record StatsResponse(
        long totalBooks,
        Map<String, Long> booksByStatus,
        long totalPagesRead,
        List<MonthCount> booksPerMonth,
        List<MonthCount> pagesPerMonth,
        double avgDaysPerBook,
        Map<Integer, Long> ratingDistribution,
        List<DayCount> activityDays,
        long booksFinishedThisYear,
        /** Últimos libros terminados, del más reciente al más antiguo. */
        List<RecentBook> recentlyFinished
) {

    @Builder
    public record RecentBook(
            Long bookId,
            String title,
            String author,
            String imageUrl,
            String imagePath,
            LocalDate endDate,
            Double rating
    ) {
    }

    @Builder
    public record MonthCount(String month, long count) {
    }

    @Builder
    public record DayCount(String date, long count) {
    }
}
