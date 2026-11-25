package com.mylibrary.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** Resultado cacheado de una consulta al diccionario (ver V10__dictionary_cache.sql). */
@Entity
@Table(name = "dictionary_cache")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DictionaryCacheEntry {

    /** Palabra en minúsculas, tal y como se consulta. */
    @Id
    @Column(length = 60)
    private String word;

    @Column(nullable = false)
    private boolean found;

    /** Entrada normalizada en JSON; nulo cuando la palabra no existe. */
    @Column(columnDefinition = "TEXT")
    private String payload;

    @Column(name = "fetched_at", nullable = false)
    @Builder.Default
    private LocalDateTime fetchedAt = LocalDateTime.now();
}
