package com.gradebook.dto;

/** Request bodies for the password endpoints (change / forgot / reset). */
public final class PasswordRequests {

    private PasswordRequests() {
    }

    public static class ChangePasswordRequest {
        private String newPassword;
        public String getNewPassword() { return newPassword; }
        public void setNewPassword(String p) { this.newPassword = p; }
    }

    public static class ForgotPasswordRequest {
        private String username;
        public String getUsername() { return username; }
        public void setUsername(String u) { this.username = u; }
    }

    public static class ResetPasswordRequest {
        private String token;
        private String newPassword;
        public String getToken() { return token; }
        public String getNewPassword() { return newPassword; }
        public void setToken(String t) { this.token = t; }
        public void setNewPassword(String p) { this.newPassword = p; }
    }
}
