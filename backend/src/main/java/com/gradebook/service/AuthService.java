package com.gradebook.service;

import com.gradebook.dto.AuthResponse;
import com.gradebook.dto.LoginRequest;
import com.gradebook.model.Admin;
import com.gradebook.model.Student;
import com.gradebook.model.Teacher;
import com.gradebook.repository.AdminRepository;
import com.gradebook.repository.StudentRepository;
import com.gradebook.repository.TeacherRepository;
import com.gradebook.security.JwtUtil;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Login. The role is decided by the server from the username, not trusted
 * from the request: an all-digits username is a student (index number);
 * an email is an admin first, then a teacher. Wrong credentials always
 * fail with the same generic message (no "user not found" vs "bad password"
 * distinction). BadCredentialsException is mapped to HTTP 401.
 */
@Service
public class AuthService {

    private final TeacherRepository teacherRepo;
    private final StudentRepository studentRepo;
    private final AdminRepository adminRepo;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder encoder;

    public AuthService(TeacherRepository teacherRepo, StudentRepository studentRepo,
                       AdminRepository adminRepo, JwtUtil jwtUtil, PasswordEncoder encoder) {
        this.teacherRepo = teacherRepo;
        this.studentRepo = studentRepo;
        this.adminRepo = adminRepo;
        this.jwtUtil = jwtUtil;
        this.encoder = encoder;
    }

    public AuthResponse login(LoginRequest req) {
        String username = req.getUsername() == null ? "" : req.getUsername().trim();
        String password = req.getPassword() == null ? "" : req.getPassword();
        if (username.isEmpty() || password.isEmpty()) {
            throw new BadCredentialsException("Invalid credentials");
        }

        if (username.matches("\\d+")) {
            Student student = studentRepo.findByIndexNumber(username)
                    .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
            if (!encoder.matches(password, student.getPassword())) {
                throw new BadCredentialsException("Invalid credentials");
            }
            return new AuthResponse(jwtUtil.generateToken(student.getIndexNumber(), "STUDENT"),
                    "STUDENT", student.getFullName());
        }

        Optional<Admin> admin = adminRepo.findByEmail(username);
        if (admin.isPresent()) {
            if (!encoder.matches(password, admin.get().getPassword())) {
                throw new BadCredentialsException("Invalid credentials");
            }
            return new AuthResponse(jwtUtil.generateToken(admin.get().getEmail(), "ADMIN"),
                    "ADMIN", admin.get().getFullName());
        }

        Teacher teacher = teacherRepo.findByEmail(username)
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        if (!encoder.matches(password, teacher.getPassword())) {
            throw new BadCredentialsException("Invalid credentials");
        }
        return new AuthResponse(jwtUtil.generateToken(teacher.getEmail(), "TEACHER"),
                "TEACHER", teacher.getFullName());
    }
}
