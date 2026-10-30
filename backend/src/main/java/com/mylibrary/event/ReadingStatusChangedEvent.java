package com.mylibrary.event;

import com.mylibrary.domain.ReadingStatus;
import lombok.Builder;

/** Domain event published whenever a book's reading status changes. */
@Builder
public record ReadingStatusChangedEvent(
        Long userId,
        Long bookId,
        String bookTitle,
        ReadingStatus previousStatus,
        ReadingStatus newStatus
) {
}
