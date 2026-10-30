package com.mylibrary.event;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Observer Pattern: reacts to status-change events without the session service
 * knowing about notification concerns. Additional observers (email, push, ...)
 * can subscribe to the same event independently.
 */
@Component
@Slf4j
public class ReadingStatusNotifier {

    @Async
    @EventListener
    public void onStatusChanged(ReadingStatusChangedEvent event) {
        log.info("Notificación [user {}]: '{}' pasó de {} a {}",
                event.userId(), event.bookTitle(), event.previousStatus(), event.newStatus());
    }
}
