CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    avatar_url  VARCHAR(500),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    description   VARCHAR(500),
    icon          VARCHAR(50),
    is_predefined BOOLEAN      NOT NULL DEFAULT FALSE,
    user_id       BIGINT REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE books (
    id          BIGSERIAL PRIMARY KEY,
    type        VARCHAR(20)  NOT NULL,
    title       VARCHAR(255) NOT NULL,
    author      VARCHAR(255) NOT NULL,
    isbn        VARCHAR(20),
    pages       INT,
    category_id BIGINT REFERENCES categories (id) ON DELETE SET NULL,
    image_url   VARCHAR(500),
    image_path  VARCHAR(500),
    description TEXT,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    user_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE reading_sessions (
    id           BIGSERIAL PRIMARY KEY,
    book_id      BIGINT      NOT NULL UNIQUE REFERENCES books (id) ON DELETE CASCADE,
    user_id      BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    start_date   DATE,
    end_date     DATE,
    rating       INT CHECK (rating BETWEEN 1 AND 5),
    notes        TEXT,
    current_page INT,
    created_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_books_user ON books (user_id);
CREATE INDEX idx_books_category ON books (category_id);
CREATE INDEX idx_sessions_user ON reading_sessions (user_id);
CREATE INDEX idx_sessions_status ON reading_sessions (status);
CREATE INDEX idx_categories_user ON categories (user_id);

INSERT INTO categories (name, description, icon, is_predefined, user_id) VALUES
    ('Ficción', 'Novelas y relatos de ficción', 'book-open', TRUE, NULL),
    ('No ficción', 'Ensayo, divulgación y biografías', 'academic-cap', TRUE, NULL),
    ('Ciencia ficción', 'Ciencia ficción y distopías', 'rocket', TRUE, NULL),
    ('Fantasía', 'Fantasía épica y urbana', 'sparkles', TRUE, NULL),
    ('Misterio', 'Novela negra, policial y thriller', 'magnifying-glass', TRUE, NULL),
    ('Historia', 'Historia y ensayo histórico', 'clock', TRUE, NULL),
    ('Técnico', 'Programación, ciencia y tecnología', 'cpu-chip', TRUE, NULL),
    ('Poesía', 'Poesía y teatro', 'pencil', TRUE, NULL);
