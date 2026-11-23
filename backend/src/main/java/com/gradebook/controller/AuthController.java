package com.gradebook.controller;

import com.gradebook.dto.AuthResponse;
import com.gradebook.dto.LoginRequest;
import com.gradebook.dto.PasswordRequests;
import com.gradebook.dto.RegisterSchoolRequest;
import com.gradebook.service.AuthService;
import com.gradebook.service.PasswordResetService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResets;

    public AuthController(AuthService authService, PasswordResetService passwordResets) {
        this.authService = authService;
        this.passwordResets = passwordResets;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest req) {
        return ResponseEntity.ok(authService.login(req));
    }

    /** Public school signup: creates the school + its first admin, logs them in. */
    @PostMapping("/register-school")
    public ResponseEntity<AuthResponse> registerSchool(@RequestBody RegisterSchoolRequest req) {
        return ResponseEntity.ok(authService.registerSchool(req));
    }

    /** Who is logged in (school included) — authenticated only. */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(Authentication auth) {
        return ResponseEntity.ok(authService.me(auth));
    }

    /** Set a new password for the logged-in user — authenticated only. */
    @PostMapping("/change-password")
    public ResponseEntity<Map<String, Object>> changePassword(
            Authentication auth, @RequestBody PasswordRequests.ChangePasswordRequest req) {
        return ResponseEntity.ok(authService.changePassword(auth, req.getNewPassword()));
    }

    /**
     * Start a password reset. Public; the answer is always the same
     * generic success so it cannot be used to probe for accounts.
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(
            @RequestBody PasswordRequests.ForgotPasswordRequest req) {
        passwordResets.requestReset(req.getUsername());
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    /** Finish a password reset with the token from the reset email/link. Public. */
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(
            @RequestBody PasswordRequests.ResetPasswordRequest req) {
        passwordResets.resetPassword(req.getToken(), req.getNewPassword());
        return ResponseEntity.ok(Map.of("status", "changed"));
    }
}
