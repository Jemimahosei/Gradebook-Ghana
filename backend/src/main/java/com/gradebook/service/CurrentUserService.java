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
import java.util.Objects;

/**
 * Shared helpers: resolve the logged-in user, their school, and grade letters.
 *
 * Multi-tenancy rule (MVP): the school is resolved from the authenticated
 * user in the database on every request — never from a JWT claim and never
 * from a request parameter. A null school on a user row can only mean a
 * pre-upgrade row that the startup backfill has not fixed yet; the
 * schoolOf* helpers fall back to the user's class (students) and then to
 * the demo school so those rows stay reachable.
 */
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

    // ---- school resolution ----

    /** The school an admin manages (never null after backfill). */
    public School schoolOfAdmin(Admin admin) {
        if (admin.getSchool() != null) {
            return admin.getSchool();
        }
        return demoSchool();
    }

    /** The school a teacher works for (never null after backfill). */
    public School schoolOfTeacher(Teacher teacher) {
        if (teacher.getSchool() != null) {
            return teacher.getSchool();
        }
        return demoSchool();
    }

    /** A student's school: the student's own school, else their class's school. */
    public School schoolOfStudent(Student student) {
        if (student.getSchool() != null) {
            return student.getSchool();
        }
        if (student.getSchoolClass() != null && student.getSchoolClass().getSchool() != null) {
            return student.getSchoolClass().getSchool();
        }
        return demoSchool();
    }

    /** True when both schools are the same school (null-safe via schoolOf* fallbacks). */
    public boolean sameSchool(School a, School b) {
        if (a == null || b == null) {
            return false;
        }
        return Objects.equals(a.getId(), b.getId());
    }

    /** The school of the logged-in user, from their role. */
    public School currentSchool(Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        boolean isTeacher = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_TEACHER"));
        if (isAdmin) {
            return schoolOfAdmin(currentAdmin(auth));
        }
        if (isTeacher) {
            return schoolOfTeacher(currentTeacher(auth));
        }
        return schoolOfStudent(currentStudent(auth));
    }

    /** The seeded demo school (demo=true), falling back to the first school. */
    public School demoSchool() {
        return schools.findFirstByDemoTrue()
                .or(() -> schools.findFirstByOrderByIdAsc())
                .orElseThrow(() -> new IllegalStateException("No school configured"));
    }

    // ---- grading scale (school-scoped) ----

    /** Grading scale rows for one school, highest band first. */
    public List<GradingScale> scales(School school) {
        return scales.findBySchoolOrderByMinScoreDesc(school);
    }

    /** Letter for a total, from the school's admin-editable scale (WAEC fallback when empty). */
    public String letterFor(School school, double total) {
        List<GradingScale> rows = scales(school);
        if (rows.isEmpty()) {
            return WaecGrading.letter(total);
        }
        return rows.stream().filter(s -> s.contains(total)).map(GradingScale::getLetter)
                .findFirst().orElse(WaecGrading.letter(total));
    }

    public String remarkFor(School school, double total) {
        List<GradingScale> rows = scales(school);
        if (rows.isEmpty()) {
            return WaecGrading.remark(total);
        }
        return rows.stream().filter(s -> s.contains(total)).map(GradingScale::getRemark)
                .findFirst().orElse(WaecGrading.remark(total));
    }
}
