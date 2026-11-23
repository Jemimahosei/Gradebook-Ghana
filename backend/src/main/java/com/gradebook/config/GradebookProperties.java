package com.gradebook.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The prototype's own settings, read from application.properties (which in
 * turn reads env vars). The semester lives here and nowhere else — no
 * controller or service may hardcode a semester string.
 */
@Component
public class GradebookProperties {

    @Value("${gradebook.semester}")
    private String semester;

    @Value("${gradebook.jwt-secret}")
    private String jwtSecret;

    /** Public base URL of the frontend, used to build password-reset links. */
    @Value("${gradebook.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    /** SMTP host for reset emails; blank means "not configured" (log the link instead). */
    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    public String semester() {
        return semester;
    }

    public String jwtSecret() {
        return jwtSecret;
    }

    public String frontendUrl() {
        return frontendUrl;
    }

    public boolean mailConfigured() {
        return mailHost != null && !mailHost.isBlank();
    }

    /** Sender address for reset emails: the SMTP username, or a local fallback. */
    public String mailFrom() {
        return mailUsername != null && !mailUsername.isBlank()
                ? mailUsername : "no-reply@gradebook.local";
    }
}
