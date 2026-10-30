package com.mylibrary.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Basic in-memory rate limiting for the auth endpoints: at most N requests
 * per client IP per minute (fixed window).
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private final int maxRequestsPerMinute;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public AuthRateLimitFilter(@Value("${app.rate-limit.auth-requests-per-minute}") int maxRequestsPerMinute) {
        this.maxRequestsPerMinute = maxRequestsPerMinute;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        long currentMinute = System.currentTimeMillis() / 60_000;
        Window window = windows.compute(clientIp(request), (ip, existing) ->
                existing == null || existing.minute != currentMinute ? new Window(currentMinute) : existing);

        if (window.counter.incrementAndGet() > maxRequestsPerMinute) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("""
                    {"success":false,"message":"Demasiadas peticiones. Inténtalo de nuevo en un minuto.","data":null,"timestamp":"%s"}
                    """.formatted(java.time.LocalDateTime.now()));
            return;
        }
        filterChain.doFilter(request, response);
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded != null ? forwarded.split(",")[0].trim() : request.getRemoteAddr();
    }

    private record Window(long minute, AtomicInteger counter) {
        Window(long minute) {
            this(minute, new AtomicInteger());
        }
    }
}
