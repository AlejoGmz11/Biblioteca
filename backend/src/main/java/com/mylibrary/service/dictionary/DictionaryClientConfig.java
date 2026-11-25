package com.mylibrary.service.dictionary;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/** Cliente HTTP del servicio de definiciones, con tiempos de espera cortos: el lector no debe quedarse colgado. */
@Configuration
class DictionaryClientConfig {

    @Bean
    RestClient dictionaryRestClient(RestClient.Builder builder, DictionaryProperties props) {
        int timeoutMs = (int) Duration.ofSeconds(props.timeoutSeconds()).toMillis();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        return builder
                .requestFactory(factory)
                .baseUrl(props.url())
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
