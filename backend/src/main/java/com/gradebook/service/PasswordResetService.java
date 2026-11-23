package com.gradebook.service;

import com.gradebook.config.GradebookProperties;
import com.gradebook.model.Admin;
import com.gradebook.model.PasswordResetToken;
import com.gradebook.model.Teacher;
import com.gradebook.repository.AdminRepository;
import com.gradebook.repository.PasswordResetTokenRepository;
import com.gradebook.repository.TeacherRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Forgot-password flow for email accounts (admins and teachers).
 * Students log in with an index number and have no email — their admin
 * resets them from the students page instead.
 *
 * Delivery: there was no mail setup in this backend. When SMTP is
 * configured (SPRING_MAIL_HOST + credentials in the environment), the
 * reset link is emailed. When it is not, the link is written to the
 * server log — the same "shown once, passed on by hand" pattern the app
 * already uses for temporary passwords — and the user completes the
 * reset by pasting the token into the app's reset form. Credentials are
 * only ever read from the environment, never hardcoded.
 *
 * The request endpoint never reveals whether an account exists.
 */
@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;
    private static final long TOKEN_TTL_MINUTES = 60;

    private final AdminRepository admins;
    private final TeacherRepository teachers;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder encoder;
    private final GradebookProperties props;
    private final JavaMailSender mailSender;

    public PasswordResetService(AdminRepository admins, TeacherRepository teachers,
                                PasswordResetTokenRepository tokens, PasswordEncoder encoder,
                                GradebookProperties props, JavaMailSender mailSender) {
        this.admins = admins;
        this.teachers = teachers;
        this.tokens = tokens;
        this.encoder = encoder;
        this.props = props;
        this.mailSender = mailSender;
    }

    /**
     * Start a reset for an email account. Unknown usernames, student
     * index numbers and blank input are silently ignored — the caller
     * always answers the same generic success so accounts cannot be
     * enumerated.
     */
    @Transactional
    public void requestReset(String username) {
        String name = username == null ? "" : username.trim();
        if (name.isEmpty() || name.matches("\\d+")) {
            return; // students have no email; the admin resets them
        }
        boolean exists = admins.findByEmail(name).isPresent() || teachers.findByEmail(name).isPresent();
        if (!exists) {
            return;
        }
        byte[] raw = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        tokens.deleteByUsername(name);
        PasswordResetToken row = new PasswordResetToken();
        row.setUsername(name);
        row.setTokenHash(sha256(token));
        row.setExpiresAt(LocalDateTime.now().plusMinutes(TOKEN_TTL_MINUTES));
        tokens.save(row);

        deliver(name, token);
    }

    /** Complete a reset: consume the token and set the new password. */
    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters");
        }
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Enter the reset code from your email");
        }
        PasswordResetToken row = tokens.findByTokenHash(sha256(token.trim()))
                .orElseThrow(() -> new IllegalArgumentException(
                        "That reset code is not valid. Ask for a new one."));
        if (row.isUsed() || row.isExpired()) {
            throw new IllegalArgumentException(
                    "That reset code has expired or was already used. Ask for a new one.");
        }
        String hash = encoder.encode(newPassword);
        Optional<Admin> admin = admins.findByEmail(row.getUsername());
        if (admin.isPresent()) {
            admin.get().setPassword(hash);
            admin.get().setMustChangePassword(false);
            admins.save(admin.get());
        } else {
            Teacher teacher = teachers.findByEmail(row.getUsername())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "That reset code is not valid. Ask for a new one."));
            teacher.setPassword(hash);
            teacher.setMustChangePassword(false);
            teachers.save(teacher);
        }
        row.setUsed(true);
        tokens.save(row);
    }

    private void deliver(String email, String token) {
        String link = props.frontendUrl() + "/reset-password?token=" + token;
        if (props.mailConfigured()) {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setFrom(props.mailFrom());
                msg.setTo(email);
                msg.setSubject("Reset your Gradebook Ghana password");
                msg.setText("Hello,\n\nUse this link within one hour to choose a new password:\n"
                        + link + "\n\nOr open the app's reset page and enter this code:\n"
                        + token + "\n\nIf you did not ask for this, you can ignore this email.");
                mailSender.send(msg);
                log.info("Password reset email sent to {}", email);
                return;
            } catch (Exception e) {
                // Fall through to the log line so the reset is never lost
                // just because the mail server is unreachable.
                log.warn("Password reset email to {} failed ({}); logging the link instead",
                        email, e.getMessage());
            }
        }
        log.warn("Password reset link for {} (no mail configured — pass this link to the user): {}",
                email, link);
    }

    private static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
