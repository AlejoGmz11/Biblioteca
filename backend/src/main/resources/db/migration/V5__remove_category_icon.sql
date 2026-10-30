-- El icono (emoji) de las categorías se sustituye por avatares generados en el
-- frontend a partir del nombre: la columna ya no se usa.
ALTER TABLE categories
    DROP COLUMN IF EXISTS icon;
