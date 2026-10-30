package com.mylibrary.domain;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Base book entity. Concrete subtypes (physical, digital, audiobook) use
 * single-table inheritance discriminated by the {@code type} column, so the
 * hierarchy can be extended without touching existing persistence code (OCP)
 * and every subtype is substitutable wherever a Book is expected (LSP).
 */
@Entity
@Table(name = "books")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "type", discriminatorType = DiscriminatorType.STRING, length = 20)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
public abstract class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String author;

    @Column(length = 20)
    private String isbn;

    private Integer pages;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "book_categories",
            joinColumns = @JoinColumn(name = "book_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id"))
    @Builder.Default
    private Set<Category> categories = new LinkedHashSet<>();

    /** Saga/trilogía a la que pertenece; null si es autoconclusivo. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "saga_id")
    private Saga saga;

    /** Posición dentro de la saga (1, 2, 3…). */
    @Column(name = "saga_order")
    private Integer sagaOrder;

    /** Clave del archivo en el almacenamiento S3; null si no tiene ebook adjunto. */
    @Column(name = "ebook_key", length = 500)
    private String ebookKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "ebook_format", length = 10)
    private EbookFormat ebookFormat;

    /** Tamaño del ebook en bytes. */
    @Column(name = "ebook_size")
    private Long ebookSize;

    public boolean hasEbook() {
        return ebookKey != null;
    }

    /** Read-only view of the discriminator so queries can filter by type. */
    @Column(name = "type", insertable = false, updatable = false)
    @Enumerated(EnumType.STRING)
    private BookType type;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "image_path", length = 500)
    private String imagePath;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @OneToOne(mappedBy = "book", cascade = CascadeType.ALL, orphanRemoval = true)
    private ReadingSession session;

    /** Each subtype declares its own type — polymorphic instead of a switch. */
    public abstract BookType getBookType();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
