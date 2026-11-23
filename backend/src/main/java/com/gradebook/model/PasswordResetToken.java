package com.gradebook.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * A single-use password-reset token for an admin or teacher account
 * (students have no email and are reset by their admin instead).
 * Only the SHA-256 hash of the token is stored — the raw token travels
 * in the reset link (emailed when SMTP is configured, otherwise logged
 * server-side) and is typed back into the app by the user.
 */
@Entity
@Table(name = "password_reset_tokens")
public class PasswordResetToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The account's login email (admin or teacher). */
    @Column(nullable = false) private String username;

    @Column(nullable = false, unique = true) private String tokenHash;

    @Column(nullable = false) private LocalDateTime expiresAt;
    private boolean used = false;

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getTokenHash() { return tokenHash; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public boolean isUsed() { return used; }
    public void setId(Long id) { this.id = id; }
    public void setUsername(String u) { this.username = u; }
    public void setTokenHash(String h) { this.tokenHash = h; }
    public void setExpiresAt(LocalDateTime t) { this.expiresAt = t; }
    public void setUsed(boolean u) { this.used = u; }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }
}
