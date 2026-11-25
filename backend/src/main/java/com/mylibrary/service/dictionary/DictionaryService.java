package com.mylibrary.service.dictionary;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mylibrary.domain.DictionaryCacheEntry;
import com.mylibrary.dto.dictionary.DictionaryEntryResponse;
import com.mylibrary.dto.dictionary.DictionaryEntryResponse.Lemma;
import com.mylibrary.dto.dictionary.DictionaryEntryResponse.Sense;
import com.mylibrary.exception.BadRequestException;
import com.mylibrary.exception.ExternalServiceException;
import com.mylibrary.repository.DictionaryCacheRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Definiciones para el lector. Consulta primero la caché propia y solo llama al
 * servicio externo (API pública de la RAE) si la palabra no está o ha caducado.
 * Al servicio solo viaja la palabra: nunca el libro, el texto ni el usuario.
 */
@Service
@Slf4j
public class DictionaryService {

    /** Una sola palabra: letras (con tildes) y, dentro, apóstrofo o guion. */
    private static final Pattern WORD = Pattern.compile("^\\p{L}[\\p{L}'’-]{0,59}$");
    private static final Locale ES = Locale.forLanguageTag("es");

    private static final int MAX_LEMMAS = 4;
    private static final int MAX_SENSES = 15;
    private static final int MAX_EXAMPLES = 2;

    /** Marcas de uso del servicio externo (en inglés) que sabemos traducir; el resto se omite. */
    private static final Map<String, String> USAGE_LABELS = Map.of("obsolete", "desusado");

    private final DictionaryCacheRepository cache;
    private final ObjectMapper mapper;
    private final DictionaryProperties props;
    private final RestClient client;

    public DictionaryService(DictionaryCacheRepository cache, ObjectMapper mapper,
                             DictionaryProperties props, RestClient dictionaryRestClient) {
        this.cache = cache;
        this.mapper = mapper;
        this.props = props;
        this.client = dictionaryRestClient;
    }

    public DictionaryEntryResponse lookup(String rawWord) {
        String word = normalize(rawWord);

        Optional<DictionaryEntryResponse> cached = cache.findById(word)
                .filter(this::isFresh)
                .flatMap(entry -> read(word, entry));
        if (cached.isPresent()) {
            return cached.get();
        }

        DictionaryEntryResponse entry = fetch(word);
        store(word, entry);
        return entry;
    }

    private String normalize(String rawWord) {
        String word = rawWord == null ? "" : Normalizer.normalize(rawWord.strip(), Normalizer.Form.NFC).toLowerCase(ES);
        if (!WORD.matcher(word).matches()) {
            throw new BadRequestException("Palabra no válida");
        }
        return word;
    }

    private boolean isFresh(DictionaryCacheEntry entry) {
        int days = entry.isFound() ? props.cacheDays() : props.missCacheDays();
        return entry.getFetchedAt().plusDays(days).isAfter(LocalDateTime.now());
    }

    /** Vacío si la fila no se puede leer (formato antiguo): se vuelve a pedir y se sobrescribe. */
    private Optional<DictionaryEntryResponse> read(String word, DictionaryCacheEntry entry) {
        if (!entry.isFound()) {
            return Optional.of(DictionaryEntryResponse.notFound(word));
        }
        try {
            return Optional.of(mapper.readValue(entry.getPayload(), DictionaryEntryResponse.class));
        } catch (JsonProcessingException | IllegalArgumentException e) {
            log.warn("Entrada de caché ilegible para '{}', se vuelve a consultar", word);
            return Optional.empty();
        }
    }

    private DictionaryEntryResponse fetch(String word) {
        try {
            JsonNode body = client.get().uri("/{word}", word).retrieve().body(JsonNode.class);
            return map(word, body);
        } catch (HttpClientErrorException.NotFound e) {
            return DictionaryEntryResponse.notFound(word);
        } catch (RestClientException e) {
            throw new ExternalServiceException(
                    "El diccionario no está disponible ahora. Inténtalo de nuevo en un momento.", e);
        }
    }

    private void store(String word, DictionaryEntryResponse entry) {
        try {
            cache.save(DictionaryCacheEntry.builder()
                    .word(word)
                    .found(entry.found())
                    .payload(entry.found() ? mapper.writeValueAsString(entry) : null)
                    .fetchedAt(LocalDateTime.now())
                    .build());
        } catch (JsonProcessingException e) {
            log.warn("No se pudo guardar en caché la palabra '{}'", word, e);
        } catch (DataIntegrityViolationException e) {
            // Dos usuarios consultaron la misma palabra nueva a la vez: ya la guardó el otro
            log.debug("Palabra '{}' ya cacheada por otra petición", word);
        }
    }

    // --- del formato del servicio externo al nuestro ---

    private DictionaryEntryResponse map(String word, JsonNode body) {
        List<Lemma> lemmas = new ArrayList<>();
        for (JsonNode meaning : body.path("data").path("meanings")) {
            if (lemmas.size() >= MAX_LEMMAS) {
                break;
            }
            List<Sense> senses = senses(meaning.path("senses"));
            if (senses.isEmpty()) {
                continue;
            }
            JsonNode homonym = meaning.path("homonym_index");
            lemmas.add(new Lemma(
                    text(meaning.path("lemma")),
                    homonym.isInt() ? homonym.asInt() : null,
                    text(meaning.path("origin").path("raw")),
                    senses));
        }
        if (lemmas.isEmpty()) {
            return DictionaryEntryResponse.notFound(word);
        }
        return new DictionaryEntryResponse(word, true, keepHomonymsOnlyWhenNeeded(lemmas));
    }

    /** El número de homónimo solo aporta si hay varias entradas del mismo lema («haber¹», «haber²»). */
    private List<Lemma> keepHomonymsOnlyWhenNeeded(List<Lemma> lemmas) {
        Map<String, Long> perLemma = lemmas.stream()
                .collect(Collectors.groupingBy(Lemma::lemma, Collectors.counting()));
        return lemmas.stream()
                .map(l -> perLemma.get(l.lemma()) > 1 ? l : new Lemma(l.lemma(), null, l.etymology(), l.senses()))
                .toList();
    }

    private List<Sense> senses(JsonNode nodes) {
        List<Sense> senses = new ArrayList<>();
        for (JsonNode node : nodes) {
            if (senses.size() >= MAX_SENSES) {
                break;
            }
            String definition = firstNonBlank(text(node.path("description")), text(node.path("raw")));
            if (definition.isEmpty()) {
                continue;
            }
            senses.add(new Sense(
                    number(node),
                    firstNonBlank(text(node.path("category_labels").path(0)), text(node.path("category"))),
                    USAGE_LABELS.getOrDefault(text(node.path("usage")), ""),
                    definition,
                    examples(node.path("examples"))));
        }
        return senses;
    }

    private String number(JsonNode sense) {
        int n = sense.path("meaning_number").asInt(0);
        String sub = text(sense.path("sub_meaning"));
        if (n == 0) {
            return "";
        }
        return sub.isEmpty() ? String.valueOf(n) : n + "." + sub;
    }

    private List<String> examples(JsonNode nodes) {
        List<String> examples = new ArrayList<>();
        for (JsonNode node : nodes) {
            String example = text(node);
            if (!example.isEmpty() && examples.size() < MAX_EXAMPLES) {
                examples.add(example);
            }
        }
        return examples;
    }

    private static String text(JsonNode node) {
        return node.isTextual() ? node.asText().strip() : "";
    }

    private static String firstNonBlank(String first, String second) {
        return first.isEmpty() ? second : first;
    }
}
