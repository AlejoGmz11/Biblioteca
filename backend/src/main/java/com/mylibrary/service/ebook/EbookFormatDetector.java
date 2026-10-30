package com.mylibrary.service.ebook;

import com.mylibrary.domain.EbookFormat;
import com.mylibrary.exception.BadRequestException;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Detecta el formato por el contenido real del archivo (magic bytes), sin
 * fiarse de la extensión ni del Content-Type enviado por el cliente.
 */
@Component
public class EbookFormatDetector {

    private static final byte[] PDF_MAGIC = "%PDF".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] ZIP_MAGIC = {0x50, 0x4B, 0x03, 0x04}; // PK 0x03 0x04
    private static final String EPUB_MIMETYPE = "application/epub+zip";

    public EbookFormat detect(Path file) {
        byte[] header = readHeader(file, 4);
        if (startsWith(header, PDF_MAGIC)) {
            return EbookFormat.PDF;
        }
        if (startsWith(header, ZIP_MAGIC) && isEpub(file)) {
            return EbookFormat.EPUB;
        }
        throw new BadRequestException("Formato no soportado: solo se admiten archivos PDF o EPUB");
    }

    /** Un EPUB es un ZIP con la entrada mimetype = application/epub+zip. */
    private boolean isEpub(Path file) {
        try (ZipFile zip = new ZipFile(file.toFile())) {
            ZipEntry mimetype = zip.getEntry("mimetype");
            if (mimetype == null) {
                return zip.getEntry("META-INF/container.xml") != null;
            }
            try (InputStream in = zip.getInputStream(mimetype)) {
                String value = new String(in.readAllBytes(), StandardCharsets.US_ASCII).trim();
                return EPUB_MIMETYPE.equals(value);
            }
        } catch (IOException e) {
            return false;
        }
    }

    private static byte[] readHeader(Path file, int length) {
        try (InputStream in = Files.newInputStream(file)) {
            byte[] buffer = new byte[length];
            int read = in.readNBytes(buffer, 0, length);
            return read == length ? buffer : Arrays.copyOf(buffer, Math.max(read, 0));
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer el archivo subido", e);
        }
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) {
            return false;
        }
        return Arrays.equals(Arrays.copyOf(data, prefix.length), prefix);
    }
}
