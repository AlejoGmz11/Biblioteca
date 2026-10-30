package com.mylibrary.service.ebook;

import com.mylibrary.domain.EbookFormat;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Lee título, autor y páginas del propio archivo para pre-rellenar el
 * formulario. Nunca falla: si algo no se puede leer, devuelve lo que haya.
 */
@Component
@Slf4j
public class EbookMetadataExtractor {

    private static final String DC_NS = "http://purl.org/dc/elements/1.1/";
    private static final String CONTAINER_NS = "urn:oasis:names:tc:opendocument:xmlns:container";

    public EbookMetadata extract(Path file, EbookFormat format) {
        try {
            return switch (format) {
                case PDF -> extractPdf(file);
                case EPUB -> extractEpub(file);
            };
        } catch (Exception e) {
            log.debug("No se pudieron extraer metadatos ({}): {}", format, e.getMessage());
            return EbookMetadata.EMPTY;
        }
    }

    private EbookMetadata extractPdf(Path file) throws Exception {
        try (PDDocument document = Loader.loadPDF(file.toFile())) {
            PDDocumentInformation info = document.getDocumentInformation();
            return EbookMetadata.builder()
                    .title(clean(info == null ? null : info.getTitle()))
                    .author(clean(info == null ? null : info.getAuthor()))
                    .pages(document.getNumberOfPages() > 0 ? document.getNumberOfPages() : null)
                    .build();
        }
    }

    /**
     * EPUB = ZIP. META-INF/container.xml apunta al OPF, que lleva los
     * metadatos Dublin Core (dc:title, dc:creator). Se parsea con el JDK,
     * sin dependencias externas.
     */
    private EbookMetadata extractEpub(Path file) throws Exception {
        try (ZipFile zip = new ZipFile(file.toFile())) {
            String opfPath = findOpfPath(zip);
            ZipEntry opfEntry = opfPath == null ? null : zip.getEntry(opfPath);
            if (opfEntry == null) {
                return EbookMetadata.EMPTY;
            }
            try (InputStream in = zip.getInputStream(opfEntry)) {
                Document opf = secureParser().parse(in);
                return EbookMetadata.builder()
                        .title(clean(firstText(opf, "title")))
                        .author(clean(firstText(opf, "creator")))
                        .build();
            }
        }
    }

    private String findOpfPath(ZipFile zip) throws Exception {
        ZipEntry container = zip.getEntry("META-INF/container.xml");
        if (container == null) {
            return null;
        }
        try (InputStream in = zip.getInputStream(container)) {
            Document doc = secureParser().parse(in);
            NodeList rootfiles = doc.getElementsByTagNameNS(CONTAINER_NS, "rootfile");
            if (rootfiles.getLength() == 0) {
                rootfiles = doc.getElementsByTagName("rootfile");
            }
            if (rootfiles.getLength() == 0) {
                return null;
            }
            String path = ((Element) rootfiles.item(0)).getAttribute("full-path");
            return path.isBlank() ? null : path;
        }
    }

    private static String firstText(Document doc, String dcLocalName) {
        NodeList nodes = doc.getElementsByTagNameNS(DC_NS, dcLocalName);
        if (nodes.getLength() == 0) {
            nodes = doc.getElementsByTagName("dc:" + dcLocalName);
        }
        return nodes.getLength() == 0 ? null : nodes.item(0).getTextContent();
    }

    /** Parser XML endurecido: sin DTD ni entidades externas (evita XXE). */
    private static DocumentBuilder secureParser() throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder();
    }

    private static String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim().replaceAll("\s+", " ");
        return trimmed.isEmpty() ? null : trimmed;
    }
}
