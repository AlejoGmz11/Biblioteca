package com.mylibrary.service.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * Envío de correos con JavaMailSender (Spring Boot lo configura a partir de
 * spring.mail.*). En desarrollo el SMTP es Mailpit; en producción, el
 * proveedor que se indique por variables de entorno.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MailService {

    private final JavaMailSender mailSender;

    @Value("${app.password-reset.from}")
    private String from;

    public void sendPasswordReset(String to, String username, String resetLink, int expirationMinutes) {
        String subject = "Restablece tu contraseña de MyLibrary";
        String html = """
                <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#333d29">
                  <h2 style="color:#7f4f24">Hola, %s</h2>
                  <p>Hemos recibido una solicitud para restablecer tu contraseña de <strong>MyLibrary</strong>.</p>
                  <p style="margin:24px 0">
                    <a href="%s" style="background:#7f4f24;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
                      Elegir una contraseña nueva
                    </a>
                  </p>
                  <p style="font-size:14px;color:#656d4a">
                    El enlace caduca en %d minutos y solo se puede usar una vez.<br>
                    Si no has pedido esto, ignora este correo: tu contraseña no cambiará.
                  </p>
                  <p style="font-size:12px;color:#a4ac86">Si el botón no funciona, copia este enlace:<br>%s</p>
                </div>
                """.formatted(escape(username), resetLink, expirationMinutes, resetLink);
        send(to, subject, html);
    }

    private void send(String to, String subject, String html) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.send(message);
            log.info("Correo enviado a {} ({})", to, subject);
        } catch (MessagingException e) {
            throw new IllegalStateException("No se pudo componer el correo", e);
        }
    }

    private static String escape(String value) {
        return value == null ? "" : value
                .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
