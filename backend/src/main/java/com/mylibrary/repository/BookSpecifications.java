package com.mylibrary.repository;

import com.mylibrary.domain.Book;
import com.mylibrary.domain.BookType;
import com.mylibrary.domain.ReadingSession;
import com.mylibrary.domain.ReadingStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;

/** Composable filters for the book listing endpoint. */
public final class BookSpecifications {

    private BookSpecifications() {
    }

    public static Specification<Book> ownedBy(Long userId) {
        return (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
    }

    public static Specification<Book> hasStatus(ReadingStatus status) {
        return (root, query, cb) -> {
            Join<Book, ReadingSession> session = root.join("session", JoinType.LEFT);
            return cb.equal(session.get("status"), status);
        };
    }

    public static Specification<Book> hasCategory(Long categoryId) {
        return (root, query, cb) -> {
            query.distinct(true);
            return cb.equal(root.join("categories").get("id"), categoryId);
        };
    }

    public static Specification<Book> hasType(BookType type) {
        return (root, query, cb) -> cb.equal(root.get("type"), type);
    }

    public static Specification<Book> inSaga(Long sagaId) {
        return (root, query, cb) -> cb.equal(root.get("saga").get("id"), sagaId);
    }

    /** Libros autoconclusivos: sin saga asociada. */
    public static Specification<Book> standalone() {
        return (root, query, cb) -> cb.isNull(root.get("saga"));
    }

    public static Specification<Book> byAuthor(String author) {
        return (root, query, cb) ->
                cb.like(cb.lower(root.get("author")), "%" + author.toLowerCase() + "%");
    }

    public static Specification<Book> matchesSearch(String term) {
        String like = "%" + term.toLowerCase() + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("title")), like),
                cb.like(cb.lower(root.get("author")), like),
                cb.like(cb.lower(cb.coalesce(root.get("isbn"), "")), like));
    }
}
