package com.mylibrary.service.dictionary;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Servicio externo de definiciones y política de caché (app.dictionary.*).
 *
 * @param url            base de la API: se le añade {@code /{palabra}}
 * @param cacheDays      días que se reutiliza una definición ya descargada
 * @param missCacheDays  días que se recuerda que una palabra no existe
 * @param timeoutSeconds espera máxima de conexión y de lectura
 */
@ConfigurationProperties(prefix = "app.dictionary")
public record DictionaryProperties(
        @DefaultValue("https://rae-api.com/api/words") String url,
        @DefaultValue("90") int cacheDays,
        @DefaultValue("7") int missCacheDays,
        @DefaultValue("5") int timeoutSeconds
) {
}
