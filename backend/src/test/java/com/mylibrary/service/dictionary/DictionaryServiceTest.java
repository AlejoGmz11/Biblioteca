package com.mylibrary.service.dictionary;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mylibrary.domain.DictionaryCacheEntry;
import com.mylibrary.dto.dictionary.DictionaryEntryResponse;
import com.mylibrary.exception.BadRequestException;
import com.mylibrary.exception.ExternalServiceException;
import com.mylibrary.repository.DictionaryCacheRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ExtendWith(MockitoExtension.class)
class DictionaryServiceTest {

    private static final String BASE = "http://dict.test/api/words";

    /** Forma del servicio externo: dos acepciones, la primera con tres ejemplos y la segunda desusada. */
    private static final String FAROLES = """
            {"data":{"word":"faroles","meanings":[{"lemma":"farol","origin":{"raw":"De faro."},"senses":[
              {"raw":"1.a. m. Caja de vidrio.","meaning_number":1,"sub_meaning":"a","category":"noun",
               "category_labels":["sustantivo masculino"],"usage":"","description":"Caja de vidrio",
               "examples":["Un farol iluminaba la puerta.","Otro ejemplo.","Un tercero."]},
              {"raw":"2. m. Cazoleta.","meaning_number":2,"category_labels":["sustantivo masculino"],
               "usage":"obsolete","description":"Cazoleta"}
            ]}]}}
            """;

    private static final String HABER = """
            {"data":{"word":"haber","meanings":[
              {"lemma":"haber","homonym_index":1,"senses":[{"meaning_number":1,"description":"Verbo auxiliar"}]},
              {"lemma":"haber","homonym_index":2,"senses":[{"meaning_number":1,"description":"Hacienda"}]}
            ]}}
            """;

    @Mock
    private DictionaryCacheRepository cache;

    private final ObjectMapper mapper = new ObjectMapper();
    private MockRestServiceServer server;
    private DictionaryService service;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl(BASE);
        server = MockRestServiceServer.bindTo(builder).build();
        service = new DictionaryService(cache, mapper, new DictionaryProperties(BASE, 90, 7, 5), builder.build());
    }

    @Test
    void mapsTheExternalFormatAndCachesIt() {
        server.expect(requestTo(BASE + "/faroles")).andRespond(withSuccess(FAROLES, MediaType.APPLICATION_JSON));

        DictionaryEntryResponse entry = service.lookup("faroles");

        assertThat(entry.found()).isTrue();
        assertThat(entry.lemmas()).hasSize(1);
        var lemma = entry.lemmas().get(0);
        assertThat(lemma.lemma()).isEqualTo("farol");
        assertThat(lemma.etymology()).isEqualTo("De faro.");
        assertThat(lemma.homonym()).isNull();
        assertThat(lemma.senses()).hasSize(2);
        assertThat(lemma.senses().get(0).number()).isEqualTo("1.a");
        assertThat(lemma.senses().get(0).category()).isEqualTo("sustantivo masculino");
        assertThat(lemma.senses().get(0).definition()).isEqualTo("Caja de vidrio");
        assertThat(lemma.senses().get(0).examples()).containsExactly("Un farol iluminaba la puerta.", "Otro ejemplo.");
        assertThat(lemma.senses().get(1).number()).isEqualTo("2");
        assertThat(lemma.senses().get(1).usage()).isEqualTo("desusado");
        server.verify();

        ArgumentCaptor<DictionaryCacheEntry> saved = ArgumentCaptor.forClass(DictionaryCacheEntry.class);
        verify(cache).save(saved.capture());
        assertThat(saved.getValue().getWord()).isEqualTo("faroles");
        assertThat(saved.getValue().isFound()).isTrue();
        assertThat(saved.getValue().getPayload()).contains("\"lemma\":\"farol\"");
    }

    @Test
    void lowercasesAndEncodesAccentedWords() {
        server.expect(requestTo(BASE + "/hab%C3%ADan")).andRespond(withSuccess(HABER, MediaType.APPLICATION_JSON));

        DictionaryEntryResponse entry = service.lookup("  Habían ");

        assertThat(entry.word()).isEqualTo("habían");
        server.verify();
    }

    @Test
    void keepsHomonymNumbersOnlyWhenSeveralEntriesShareTheLemma() {
        server.expect(requestTo(BASE + "/haber")).andRespond(withSuccess(HABER, MediaType.APPLICATION_JSON));

        List<DictionaryEntryResponse.Lemma> lemmas = service.lookup("haber").lemmas();

        assertThat(lemmas).extracting(DictionaryEntryResponse.Lemma::homonym).containsExactly(1, 2);
    }

    @Test
    void unknownWordIsReportedAndRemembered() {
        server.expect(requestTo(BASE + "/quidditch")).andRespond(withStatus(HttpStatus.NOT_FOUND));

        DictionaryEntryResponse entry = service.lookup("quidditch");

        assertThat(entry.found()).isFalse();
        assertThat(entry.lemmas()).isEmpty();
        ArgumentCaptor<DictionaryCacheEntry> saved = ArgumentCaptor.forClass(DictionaryCacheEntry.class);
        verify(cache).save(saved.capture());
        assertThat(saved.getValue().isFound()).isFalse();
        assertThat(saved.getValue().getPayload()).isNull();
    }

    @Test
    void freshCacheEntryIsServedWithoutCallingTheService() throws Exception {
        var cached = new DictionaryEntryResponse("farol", true, List.of(new DictionaryEntryResponse.Lemma(
                "farol", null, "", List.of(new DictionaryEntryResponse.Sense("1", "", "", "Caja de vidrio", List.of())))));
        when(cache.findById("farol")).thenReturn(Optional.of(DictionaryCacheEntry.builder()
                .word("farol").found(true).payload(mapper.writeValueAsString(cached))
                .fetchedAt(LocalDateTime.now().minusDays(10)).build()));

        DictionaryEntryResponse entry = service.lookup("farol");

        assertThat(entry.lemmas().get(0).senses().get(0).definition()).isEqualTo("Caja de vidrio");
        server.verify(); // sin expectativas: cualquier llamada habría fallado
        verify(cache, never()).save(any());
    }

    @Test
    void expiredCacheEntryIsRefreshed() {
        when(cache.findById("faroles")).thenReturn(Optional.of(DictionaryCacheEntry.builder()
                .word("faroles").found(true).payload("{}").fetchedAt(LocalDateTime.now().minusDays(100)).build()));
        server.expect(requestTo(BASE + "/faroles")).andRespond(withSuccess(FAROLES, MediaType.APPLICATION_JSON));

        service.lookup("faroles");

        server.verify();
        verify(cache).save(any());
    }

    @Test
    void failuresOfTheExternalServiceAreNotCached() {
        server.expect(requestTo(BASE + "/casa")).andRespond(withServerError());

        assertThatThrownBy(() -> service.lookup("casa")).isInstanceOf(ExternalServiceException.class);
        verify(cache, never()).save(any());
    }

    @Test
    void rejectsAnythingThatIsNotASingleWord() {
        for (String bad : new String[]{"", "   ", "dos palabras", "ca/sa", "../etc", "1234", "casa?x=1", "a".repeat(61)}) {
            assertThatThrownBy(() -> service.lookup(bad)).as(bad).isInstanceOf(BadRequestException.class);
        }
        assertThatThrownBy(() -> service.lookup(null)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(cache);
    }
}
