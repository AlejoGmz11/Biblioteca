-- La descripción de las categorías era redundante
ALTER TABLE categories
    DROP COLUMN IF EXISTS description;

-- Sagas / trilogías / bilogías: agrupan libros de un mismo usuario.
-- Un libro sin saga es autoconclusivo.
CREATE TABLE sagas (
    id      BIGSERIAL PRIMARY KEY,
    name    VARCHAR(255) NOT NULL,
    user_id BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_sagas_user_name ON sagas (user_id, LOWER(name));

ALTER TABLE books
    ADD COLUMN saga_id BIGINT REFERENCES sagas (id) ON DELETE SET NULL,
    ADD COLUMN saga_order INT;

CREATE INDEX idx_books_saga ON books (saga_id);
