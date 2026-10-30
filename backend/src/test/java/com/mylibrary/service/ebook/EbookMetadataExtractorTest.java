package com.mylibrary.service.ebook;

import com.mylibrary.domain.EbookFormat;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class EbookMetadataExtractorTest {

    private final EbookMetadataExtractor extractor = new EbookMetadataExtractor();

    @TempDir
    Path dir;

    @Test
    void readsTitleAuthorAndPagesFromPdf() throws Exception {
        Path pdf = EbookFixtures.pdf(dir, "  Dune ", "Frank  Herbert", 3);

        EbookMetadata metadata = extractor.extract(pdf, EbookFormat.PDF);

        assertThat(metadata.title()).isEqualTo("Dune");
        assertThat(metadata.author()).isEqualTo("Frank Herbert");
        assertThat(metadata.pages()).isEqualTo(3);
    }

    @Test
    void readsDublinCoreMetadataFromEpub() throws Exception {
        Path epub = EbookFixtures.epub(dir, "El nombre del viento", "Patrick Rothfuss");

        EbookMetadata metadata = extractor.extract(epub, EbookFormat.EPUB);

        assertThat(metadata.title()).isEqualTo("El nombre del viento");
        assertThat(metadata.author()).isEqualTo("Patrick Rothfuss");
        assertThat(metadata.pages()).isNull();
    }

    @Test
    void neverFailsOnUnreadableContent() throws Exception {
        Path garbage = EbookFixtures.garbage(dir);

        assertThat(extractor.extract(garbage, EbookFormat.PDF)).isEqualTo(EbookMetadata.EMPTY);
        assertThat(extractor.extract(garbage, EbookFormat.EPUB)).isEqualTo(EbookMetadata.EMPTY);
    }

    @Test
    void emptyPdfInfoYieldsNullFields() throws Exception {
        Path pdf = EbookFixtures.pdf(dir, "", null, 1);

        EbookMetadata metadata = extractor.extract(pdf, EbookFormat.PDF);

        assertThat(metadata.hasTitle()).isFalse();
        assertThat(metadata.hasAuthor()).isFalse();
    }
}
