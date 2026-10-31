package com.mylibrary.dto.stats;

import lombok.Builder;

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
        long booksFinishedThisYear
) {

    @Builder
    public record MonthCount(String month, long count) {
    }

    @Builder
    public record DayCount(String date, long count) {
    }
}
