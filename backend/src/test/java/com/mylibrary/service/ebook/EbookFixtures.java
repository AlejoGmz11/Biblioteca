package com.mylibrary.service.ebook;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Genera archivos PDF y EPUB mínimos pero válidos para los tests. */
public final class EbookFixtures {

    private EbookFixtures() {
    }

    public static Path pdf(Path dir, String title, String author, int pages) throws IOException {
        Path file = dir.resolve("fixture.pdf");
        try (PDDocument document = new PDDocument()) {
            for (int i = 0; i < pages; i++) {
                document.addPage(new PDPage());
            }
            PDDocumentInformation info = new PDDocumentInformation();
            info.setTitle(title);
            info.setAuthor(author);
            document.setDocumentInformation(info);
            document.save(file.toFile());
        }
        return file;
    }

    public static Path epub(Path dir, String title, String author) throws IOException {
        Path file = dir.resolve("fixture.epub");
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(file))) {
            // Por especificación, "mimetype" va primero y sin comprimir
            ZipEntry mimetype = new ZipEntry("mimetype");
            mimetype.setMethod(ZipEntry.STORED);
            byte[] mime = "application/epub+zip".getBytes(StandardCharsets.US_ASCII);
            mimetype.setSize(mime.length);
            mimetype.setCompressedSize(mime.length);
            java.util.zip.CRC32 crc = new java.util.zip.CRC32();
            crc.update(mime);
            mimetype.setCrc(crc.getValue());
            zip.putNextEntry(mimetype);
            zip.write(mime);
            zip.closeEntry();

            write(zip, "META-INF/container.xml", """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
                      <rootfiles>
                        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
                      </rootfiles>
                    </container>
                    """);
            write(zip, "OEBPS/content.opf", """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
                      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
                        <dc:identifier id="id">urn:uuid:test</dc:identifier>
                        <dc:title>%s</dc:title>
                        <dc:creator>%s</dc:creator>
                        <dc:language>es</dc:language>
                      </metadata>
                      <manifest/>
                      <spine/>
                    </package>
                    """.formatted(title, author));
        }
        return file;
    }

    /** Un ZIP corriente (sin mimetype ni container.xml): no es un EPUB. */
    public static Path plainZip(Path dir) throws IOException {
        Path file = dir.resolve("plain.zip");
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(file))) {
            write(zip, "hello.txt", "hola");
        }
        return file;
    }

    public static Path garbage(Path dir) throws IOException {
        Path file = dir.resolve("garbage.bin");
        Files.write(file, "esto no es un ebook".getBytes(StandardCharsets.UTF_8));
        return file;
    }

    private static void write(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
