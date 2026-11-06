package com.gradebook.service;

import com.gradebook.model.Admin;
import com.gradebook.model.GradingScale;
import com.gradebook.model.School;
import com.gradebook.model.Student;
import com.gradebook.model.Teacher;
import com.gradebook.repository.AdminRepository;
import com.gradebook.repository.GradingScaleRepository;
import com.gradebook.repository.SchoolRepository;
import com.gradebook.repository.StudentRepository;
import com.gradebook.repository.TeacherRepository;
import com.gradebook.util.WaecGrading;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.List;

/** Shared helpers: resolve the logged-in user, the demo school, and grade letters. */
@Service
public class CurrentUserService {
    private final TeacherRepository teachers;
    private final StudentRepository students;
    private final AdminRepository admins;
    private final SchoolRepository schools;
    private final GradingScaleRepository scales;

    public CurrentUserService(TeacherRepository teachers, StudentRepository students,
                              AdminRepository admins, SchoolRepository schools,
                              GradingScaleRepository scales) {
        this.teachers = teachers;
        this.students = students;
        this.admins = admins;
        this.schools = schools;
        this.scales = scales;
    }

    public Teacher currentTeacher(Authentication auth) {
        return teachers.findByEmail(auth.getName())
                .orElseThrow(() -> new IllegalArgumentException("Logged-in teacher not found"));
    }

    public Student currentStudent(Authentication auth) {
        return students.findByIndexNumber(auth.getName())
                .orElseThrow(() -> new IllegalArgumentException("Logged-in student not found"));
    }

    public Admin currentAdmin(Authentication auth) {
        return admins.findByEmail(auth.getName())
                .orElseThrow(() -> new IllegalArgumentException("Logged-in admin not found"));
    }

    /** The demo school: the first (and normally only) school in the database. */
    public School demoSchool() {
        return schools.findAll().stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("No school configured"));
    }

    /** Grading scale rows, highest band first. */
    public List<GradingScale> scales() {
        return scales.findAllByOrderByMinScoreDesc();
    }

    /** Letter for a total, from the admin-editable scale (WAEC fallback when the table is empty). */
    public String letterFor(double total) {
        List<GradingScale> rows = scales();
        if (rows.isEmpty()) {
            return WaecGrading.letter(total);
        }
        return rows.stream().filter(s -> s.contains(total)).map(GradingScale::getLetter)
                .findFirst().orElse(WaecGrading.letter(total));
    }

    public String remarkFor(double total) {
        List<GradingScale> rows = scales();
        if (rows.isEmpty()) {
            return WaecGrading.remark(total);
        }
        return rows.stream().filter(s -> s.contains(total)).map(GradingScale::getRemark)
                .findFirst().orElse(WaecGrading.remark(total));
    }
}
