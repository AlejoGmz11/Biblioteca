-- Permite valoraciones con medias estrellas (0.5 a 5 en pasos de 0.5)
ALTER TABLE reading_sessions
    DROP CONSTRAINT IF EXISTS reading_sessions_rating_check;

ALTER TABLE reading_sessions
    ALTER COLUMN rating TYPE DOUBLE PRECISION USING rating::double precision;

ALTER TABLE reading_sessions
    ADD CONSTRAINT reading_sessions_rating_check
        CHECK (rating >= 0.5 AND rating <= 5 AND (rating * 2) = floor(rating * 2));
