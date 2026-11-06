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

    public String semester() {
        return semester;
    }

    public String jwtSecret() {
        return jwtSecret;
    }
}
