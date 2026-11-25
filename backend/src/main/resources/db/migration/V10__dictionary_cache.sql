-- Caché del diccionario del lector: una fila por palabra consultada. Evita volver
-- a llamar al servicio externo para la misma palabra. `found = false` recuerda
-- las palabras que el diccionario no conoce (nombres inventados, errores de
-- texto) para no insistir; `payload` es el resultado ya normalizado, en JSON.
CREATE TABLE dictionary_cache (
    word       VARCHAR(60) PRIMARY KEY,
    found      BOOLEAN   NOT NULL,
    payload    TEXT,
    fetched_at TIMESTAMP NOT NULL DEFAULT NOW()
);
