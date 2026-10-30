package com.mylibrary.service.ebook;

import com.mylibrary.domain.EbookFormat;
import com.mylibrary.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EbookFormatDetectorTest {

    private final EbookFormatDetector detector = new EbookFormatDetector();

    @TempDir
    Path dir;

    @Test
    void detectsPdfByMagicBytes() throws Exception {
        Path pdf = EbookFixtures.pdf(dir, "T", "A", 1);

        assertThat(detector.detect(pdf)).isEqualTo(EbookFormat.PDF);
    }

    @Test
    void detectsEpubByZipMimetypeEntry() throws Exception {
        Path epub = EbookFixtures.epub(dir, "T", "A");

        assertThat(detector.detect(epub)).isEqualTo(EbookFormat.EPUB);
    }

    @Test
    void rejectsPlainZipThatIsNotAnEpub() throws Exception {
        Path zip = EbookFixtures.plainZip(dir);

        assertThatThrownBy(() -> detector.detect(zip))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("PDF o EPUB");
    }

    @Test
    void rejectsArbitraryContentRegardlessOfExtension() throws Exception {
        Path fake = dir.resolve("malicioso.pdf");
        Files.write(fake, "<html>no soy un pdf</html>".getBytes());

        assertThatThrownBy(() -> detector.detect(fake)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsEmptyFile() throws Exception {
        Path empty = dir.resolve("empty.pdf");
        Files.createFile(empty);

        assertThatThrownBy(() -> detector.detect(empty)).isInstanceOf(BadRequestException.class);
    }
}
