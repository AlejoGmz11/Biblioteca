package com.mylibrary.dto.dictionary;

import java.util.List;

/**
 * Entrada de diccionario ya normalizada. El cliente no depende del formato del
 * servicio externo: si se cambia de proveedor, este contrato no cambia.
 *
 * @param word   palabra consultada (en minúsculas)
 * @param found  false si el diccionario no la conoce; {@code lemmas} va vacío
 * @param lemmas una entrada por lema: «habían» devuelve «haber», con sus homónimos
 */
public record DictionaryEntryResponse(String word, boolean found, List<Lemma> lemmas) {

    /**
     * @param lemma     forma de diccionario («farol» para «faroles»)
     * @param homonym   número de homónimo (1, 2…) cuando hay varias entradas del mismo lema; si no, nulo
     * @param etymology origen de la palabra, vacío si no consta
     */
    public record Lemma(String lemma, Integer homonym, String etymology, List<Sense> senses) {
    }

    /**
     * @param number     numeración de la acepción («1», «1.a»…)
     * @param category   clase gramatical («sustantivo masculino»…), vacía si no consta
     * @param usage      marca de uso (obsoleto, coloquial…), vacía si no consta
     * @param definition texto de la acepción
     */
    public record Sense(String number, String category, String usage, String definition, List<String> examples) {
    }

    public static DictionaryEntryResponse notFound(String word) {
        return new DictionaryEntryResponse(word, false, List.of());
    }
}
