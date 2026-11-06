package com.gradebook.controller;

import com.gradebook.dto.AuthResponse;
import com.gradebook.dto.LoginRequest;
import com.gradebook.dto.RegisterSchoolRequest;
import com.gradebook.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) { this.authService = authService; }

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
}
