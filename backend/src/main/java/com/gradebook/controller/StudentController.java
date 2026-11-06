package com.gradebook.controller;

import com.gradebook.model.SchoolClass;
import com.gradebook.model.Student;
import com.gradebook.repository.SchoolClassRepository;
import com.gradebook.repository.StudentRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Student rosters. Teacher/admin only — students use /api/student/me.
 * Returns safe shapes (no password hashes).
 */
@RestController
@RequestMapping("/api/students")
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class StudentController {
    private final StudentRepository repo;
    private final SchoolClassRepository classRepo;

    public StudentController(StudentRepository repo, SchoolClassRepository classRepo) {
        this.repo = repo;
        this.classRepo = classRepo;
    }

    @GetMapping
    public List<Map<String, Object>> getAll() {
        return repo.findAll().stream().map(this::toDto).toList();
    }

    @GetMapping("/by-class/{classId}")
    public List<Map<String, Object>> getByClass(@PathVariable Long classId) {
        SchoolClass sc = classRepo.findById(classId)
                .orElseThrow(() -> new IllegalArgumentException("Class not found: " + classId));
        return repo.findBySchoolClass(sc).stream().map(this::toDto).toList();
    }

    private Map<String, Object> toDto(Student s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("fullName", s.getFullName());
        m.put("indexNumber", s.getIndexNumber());
        m.put("programme", s.getProgramme());
        m.put("year", s.getYear());
        m.put("classId", s.getSchoolClass() == null ? null : s.getSchoolClass().getId());
        m.put("className", s.getSchoolClass() == null ? null : s.getSchoolClass().getName());
        return m;
    }
}
