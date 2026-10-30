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
        double avgDaysPerBook
) {

    @Builder
    public record MonthCount(String month, long count) {
    }
}
