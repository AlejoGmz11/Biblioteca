-- Un libro puede tener varias categorías (muchos-a-muchos)
CREATE TABLE book_categories (
    book_id     BIGINT NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, category_id)
);

CREATE INDEX idx_book_categories_category ON book_categories (category_id);

-- Conserva las asignaciones existentes
INSERT INTO book_categories (book_id, category_id)
SELECT id, category_id
FROM books
WHERE category_id IS NOT NULL;

ALTER TABLE books
    DROP COLUMN category_id;
