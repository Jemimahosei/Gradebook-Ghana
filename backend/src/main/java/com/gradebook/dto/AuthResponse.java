package com.gradebook.dto;

/**
 * Login / signup response. schoolId/schoolName let the frontend header show
 * the user's own school without an extra call; demoSchool tells the UI
 * whether to show the demo-data note (only the seeded demo school has it).
 */
public class AuthResponse {
    private String token;
    private String role;
    private String name;
    private Long schoolId;
    private String schoolName;
    private boolean demoSchool;

    public AuthResponse(String token, String role, String name) {
        this.token = token; this.role = role; this.name = name;
    }

    public AuthResponse(String token, String role, String name,
                        Long schoolId, String schoolName, boolean demoSchool) {
        this.token = token; this.role = role; this.name = name;
        this.schoolId = schoolId; this.schoolName = schoolName; this.demoSchool = demoSchool;
    }

    public String getToken() { return token; }
    public String getRole() { return role; }
    public String getName() { return name; }
    public Long getSchoolId() { return schoolId; }
    public String getSchoolName() { return schoolName; }
    public boolean isDemoSchool() { return demoSchool; }
}
