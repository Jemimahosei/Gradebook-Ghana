package com.gradebook.controller;

import com.gradebook.model.Admin;
import com.gradebook.model.Grade;
import com.gradebook.model.GradingScale;
import com.gradebook.model.School;
import com.gradebook.model.SchoolClass;
import com.gradebook.model.Student;
import com.gradebook.model.Subject;
import com.gradebook.model.SubjectAssignment;
import com.gradebook.model.Teacher;
import com.gradebook.repository.AdminRepository;
import com.gradebook.repository.GradeRepository;
import com.gradebook.repository.GradingScaleRepository;
import com.gradebook.repository.ReportCardRepository;
import com.gradebook.repository.SchoolClassRepository;
import com.gradebook.repository.SchoolRepository;
import com.gradebook.repository.StudentRepository;
import com.gradebook.repository.SubjectAssignmentRepository;
import com.gradebook.repository.SubjectRepository;
import com.gradebook.repository.TeacherRepository;
import com.gradebook.service.CurrentUserService;
import com.gradebook.util.WaecGrading;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Admin portal endpoints (Academic Head): dashboard counts, class /
 * subject / student / teacher CRUD, subject assignments, grading-scale
 * management, user list, and the school profile. ADMIN role only.
 *
 * Multi-tenancy: every read and write is scoped to the logged-in admin's
 * own school (resolved from the admin row, never from a request
 * parameter). A record from another school is treated exactly like a
 * missing record (404), so one school can never see — or guess at —
 * another school's data.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    private final CurrentUserService current;
    private final SchoolClassRepository classes;
    private final SubjectRepository subjects;
    private final StudentRepository students;
    private final GradingScaleRepository scales;
    private final TeacherRepository teachers;
    private final AdminRepository admins;
    private final SchoolRepository schools;
    private final GradeRepository grades;
    private final ReportCardRepository reportCards;
    private final SubjectAssignmentRepository assignments;
    private final PasswordEncoder passwordEncoder;

    public AdminController(CurrentUserService current, SchoolClassRepository classes,
                           SubjectRepository subjects, StudentRepository students,
                           GradingScaleRepository scales, TeacherRepository teachers,
                           AdminRepository admins, SchoolRepository schools, GradeRepository grades,
                           ReportCardRepository reportCards,
                           SubjectAssignmentRepository assignments,
                           PasswordEncoder passwordEncoder) {
        this.current = current;
        this.classes = classes;
        this.subjects = subjects;
        this.students = students;
        this.scales = scales;
        this.teachers = teachers;
        this.admins = admins;
        this.schools = schools;
        this.grades = grades;
        this.reportCards = reportCards;
        this.assignments = assignments;
        this.passwordEncoder = passwordEncoder;
    }

    // ---- DTOs ----
    public record ClassRequest(String name, String programme, int formYear, Long classTeacherId) {
    }
    public record SubjectRequest(String name, String programme, boolean isCore) {
    }
    public record StudentRequest(String fullName, String indexNumber, String programme,
                                 int year, Long classId) {
    }
    public record TeacherRequest(String fullName, String email, String subject, String password) {
    }
    public record AssignmentRequest(Long teacherId, Long subjectId, Long classId) {
    }
    public record ScaleRequest(String letter, double minScore, double maxScore, String remark) {
    }
    public record SchoolRequest(String name, String town, String region, String address, String email, String phone) {
    }

    private Map<String, Object> classDto(SchoolClass c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("name", c.getName());
        m.put("programme", c.getProgramme());
        m.put("formYear", c.getFormYear());
        m.put("classTeacherId", c.getClassTeacher() == null ? null : c.getClassTeacher().getId());
        m.put("classTeacherName", c.getClassTeacher() == null ? null : c.getClassTeacher().getFullName());
        return m;
    }

    private Map<String, Object> subjectDto(Subject s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("name", s.getName());
        m.put("programme", s.getProgramme());
        m.put("isCore", s.isCore());
        return m;
    }

    private Map<String, Object> studentDto(Student s) {
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

    private Map<String, Object> teacherDto(Teacher t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("fullName", t.getFullName());
        m.put("email", t.getEmail());
        m.put("subject", t.getSubject());
        return m;
    }

    private Map<String, Object> assignmentDto(SubjectAssignment a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("teacherId", a.getTeacher().getId());
        m.put("teacherName", a.getTeacher().getFullName());
        m.put("subjectId", a.getSubject().getId());
        m.put("subjectName", a.getSubject().getName());
        m.put("classId", a.getSchoolClass().getId());
        m.put("className", a.getSchoolClass().getName());
        return m;
    }

    private Map<String, Object> scaleDto(GradingScale s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("letter", s.getLetter());
        m.put("minScore", s.getMinScore());
        m.put("maxScore", s.getMaxScore());
        m.put("remark", s.getRemark());
        return m;
    }

    // ---- school-scoped lookups: another school's record reads as "not found" ----
    private SchoolClass requireClass(School school, Long id) {
        return classes.findById(id)
                .filter(c -> current.sameSchool(c.getSchool(), school))
                .orElseThrow(() -> new NoSuchElementException("Class not found: " + id));
    }

    private Subject requireSubject(School school, Long id) {
        return subjects.findById(id)
                .filter(s -> current.sameSchool(s.getSchool(), school))
                .orElseThrow(() -> new NoSuchElementException("Subject not found: " + id));
    }

    private Student requireStudent(School school, Long id) {
        return students.findById(id)
                .filter(s -> current.sameSchool(current.schoolOfStudent(s), school))
                .orElseThrow(() -> new NoSuchElementException("Student not found: " + id));
    }

    private Teacher requireTeacher(School school, Long id) {
        return teachers.findById(id)
                .filter(t -> current.sameSchool(t.getSchool(), school))
                .orElseThrow(() -> new NoSuchElementException("Teacher not found: " + id));
    }

    private GradingScale requireScale(School school, Long id) {
        return scales.findById(id)
                .filter(s -> current.sameSchool(s.getSchool(), school))
                .orElseThrow(() -> new NoSuchElementException("Grading scale not found: " + id));
    }

    private SubjectAssignment requireAssignment(School school, Long id) {
        return assignments.findById(id)
                .filter(a -> current.sameSchool(a.getSchoolClass().getSchool(), school))
                .orElseThrow(() -> new NoSuchElementException("Assignment not found: " + id));
    }

    private void require(boolean ok, String message) {
        if (!ok) {
            throw new IllegalArgumentException(message);
        }
    }

    /** 8-character temporary password (no ambiguous characters). Shown once, to the admin. */
    private static String generateTemporaryPassword() {
        StringBuilder sb = new StringBuilder(8);
        for (int i = 0; i < 8; i++) {
            sb.append(TEMP_PASSWORD_CHARS.charAt(RANDOM.nextInt(TEMP_PASSWORD_CHARS.length())));
        }
        return sb.toString();
    }

    /** "GENERAL ARTS" (class programmes) and "ARTS" (subject programmes) mean the same. */
    private static boolean programmeMatches(String classProgramme, String subjectProgramme) {
        if (subjectProgramme == null) {
            return false;
        }
        if ("CORE".equals(subjectProgramme)) {
            return true; // core subjects are taught in every class
        }
        return normaliseProgramme(classProgramme).equals(normaliseProgramme(subjectProgramme));
    }

    private static String normaliseProgramme(String p) {
        if (p == null) {
            return "";
        }
        return "GENERAL ARTS".equals(p) ? "ARTS" : p;
    }

    /**
     * Make sure the class teacher is assigned to every subject the class
     * takes (core + the class's programme). Called when a class is created
     * or its class teacher changes, and when a subject is created.
     * Idempotent — existing assignments are left alone.
     */
    private void ensureAssignmentsForClass(SchoolClass schoolClass) {
        Teacher teacher = schoolClass.getClassTeacher();
        if (teacher == null) {
            return;
        }
        // The class's own school is authoritative; fall back to the teacher's.
        School classSchool = schoolClass.getSchool() != null ? schoolClass.getSchool()
                : current.schoolOfTeacher(teacher);
        for (Subject s : subjects.findBySchool(classSchool)) {
            if (programmeMatches(schoolClass.getProgramme(), s.getProgramme())) {
                ensureAssignment(teacher, s, schoolClass);
            }
        }
    }

    private void ensureAssignmentsForSubject(Subject subject) {
        School school = subject.getSchool();
        if (school == null) {
            return;
        }
        for (SchoolClass c : classes.findBySchool(school)) {
            if (c.getClassTeacher() != null && programmeMatches(c.getProgramme(), subject.getProgramme())) {
                ensureAssignment(c.getClassTeacher(), subject, c);
            }
        }
    }

    private void ensureAssignment(Teacher teacher, Subject subject, SchoolClass schoolClass) {
        boolean exists = assignments.findBySchoolClass(schoolClass).stream()
                .anyMatch(a -> a.getTeacher().getId().equals(teacher.getId())
                        && a.getSubject().getId().equals(subject.getId()));
        if (!exists) {
            SubjectAssignment a = new SubjectAssignment();
            a.setTeacher(teacher);
            a.setSubject(subject);
            a.setSchoolClass(schoolClass);
            assignments.save(a);
        }
    }

    // ---- Dashboard ----
    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(Authentication auth) {
        School school = current.currentSchool(auth);
        List<Map<String, Object>> summaries = new ArrayList<>();
        for (SchoolClass c : classes.findBySchool(school)) {
            List<Student> roster = students.findBySchoolClass(c);
            Double avg = WaecGrading.average(roster.stream()
                    .flatMap(s -> grades.findByStudentId(s.getId()).stream())
                    .map(g -> g.getScore()).toList());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("classId", c.getId());
            m.put("className", c.getName());
            m.put("studentCount", roster.size());
            m.put("average", avg);
            summaries.add(m);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("studentCount", students.findBySchool(school).size());
        result.put("teacherCount", teachers.findBySchool(school).size());
        result.put("classCount", classes.findBySchool(school).size());
        result.put("subjectCount", subjects.findBySchool(school).size());
        result.put("assessmentCount", 0); // no assessment model in this prototype
        result.put("classSummaries", summaries);
        return result;
    }

    // ---- Classes ----
    @GetMapping("/classes")
    public List<Map<String, Object>> listClasses(Authentication auth) {
        School school = current.currentSchool(auth);
        return classes.findBySchool(school).stream().map(this::classDto).toList();
    }

    @PostMapping("/classes")
    public Map<String, Object> createClass(Authentication auth, @RequestBody ClassRequest body) {
        School school = current.currentSchool(auth);
        require(body.name() != null && !body.name().isBlank(), "Class name is required");
        SchoolClass c = new SchoolClass();
        c.setName(body.name().trim());
        c.setProgramme(body.programme() == null ? "SCIENCE" : body.programme());
        c.setFormYear(body.formYear());
        c.setSchool(school);
        if (body.classTeacherId() != null) {
            c.setClassTeacher(requireTeacher(school, body.classTeacherId()));
        }
        SchoolClass saved = classes.save(c);
        ensureAssignmentsForClass(saved);
        return classDto(saved);
    }

    @PutMapping("/classes/{id}")
    public Map<String, Object> updateClass(Authentication auth, @PathVariable Long id,
                                           @RequestBody ClassRequest body) {
        School school = current.currentSchool(auth);
        SchoolClass c = requireClass(school, id);
        if (body.name() != null && !body.name().isBlank()) {
            c.setName(body.name().trim());
        }
        if (body.programme() != null) {
            c.setProgramme(body.programme());
        }
        if (body.formYear() != 0) {
            c.setFormYear(body.formYear());
        }
        if (body.classTeacherId() != null) {
            c.setClassTeacher(requireTeacher(school, body.classTeacherId()));
        }
        SchoolClass saved = classes.save(c);
        ensureAssignmentsForClass(saved);
        return classDto(saved);
    }

    @DeleteMapping("/classes/{id}")
    public void deleteClass(Authentication auth, @PathVariable Long id) {
        School school = current.currentSchool(auth);
        SchoolClass c = requireClass(school, id);
        require(students.findBySchoolClass(c).isEmpty(),
                "Cannot delete a class that still has students — move or remove them first");
        assignments.findBySchoolClass(c).forEach(assignments::delete);
        classes.delete(c);
    }

    // ---- Subjects ----
    @GetMapping("/subjects")
    public List<Map<String, Object>> listSubjects(Authentication auth) {
        School school = current.currentSchool(auth);
        return subjects.findBySchool(school).stream().map(this::subjectDto).toList();
    }

    @PostMapping("/subjects")
    public Map<String, Object> createSubject(Authentication auth, @RequestBody SubjectRequest body) {
        School school = current.currentSchool(auth);
        require(body.name() != null && !body.name().isBlank(), "Subject name is required");
        Subject s = new Subject();
        s.setName(body.name().trim());
        s.setProgramme(body.programme() == null ? "CORE" : body.programme());
        s.setCore(body.isCore());
        s.setSchool(school);
        Subject saved = subjects.save(s);
        ensureAssignmentsForSubject(saved);
        return subjectDto(saved);
    }

    @PutMapping("/subjects/{id}")
    public Map<String, Object> updateSubject(Authentication auth, @PathVariable Long id,
                                             @RequestBody SubjectRequest body) {
        School school = current.currentSchool(auth);
        Subject s = requireSubject(school, id);
        if (body.name() != null && !body.name().isBlank()) {
            s.setName(body.name().trim());
        }
        if (body.programme() != null) {
            s.setProgramme(body.programme());
        }
        s.setCore(body.isCore());
        Subject saved = subjects.save(s);
        ensureAssignmentsForSubject(saved);
        return subjectDto(saved);
    }

    @DeleteMapping("/subjects/{id}")
    public void deleteSubject(Authentication auth, @PathVariable Long id) {
        School school = current.currentSchool(auth);
        Subject s = requireSubject(school, id);
        require(grades.findAll().stream().noneMatch(g -> g.getSubject().getId().equals(id)),
                "Cannot delete a subject that already has grades");
        // Remove this subject's assignments in every class of the school.
        for (SchoolClass c : classes.findBySchool(school)) {
            assignments.findBySchoolClass(c).stream()
                    .filter(a -> a.getSubject().getId().equals(id))
                    .forEach(assignments::delete);
        }
        subjects.delete(s);
    }

    // ---- Students ----
    @GetMapping("/students")
    public List<Map<String, Object>> listStudents(Authentication auth) {
        School school = current.currentSchool(auth);
        return students.findBySchool(school).stream().map(this::studentDto).toList();
    }

    @PostMapping("/students")
    public Map<String, Object> createStudent(Authentication auth, @RequestBody StudentRequest body) {
        School school = current.currentSchool(auth);
        require(body.fullName() != null && !body.fullName().isBlank(), "Student name is required");
        require(body.indexNumber() != null && !body.indexNumber().isBlank(), "Index number is required");
        require(students.findByIndexNumber(body.indexNumber().trim()).isEmpty(),
                "Index number already exists: " + body.indexNumber());
        Student s = new Student();
        s.setFullName(body.fullName().trim());
        s.setIndexNumber(body.indexNumber().trim());
        String temporaryPassword = generateTemporaryPassword();
        s.setPassword(passwordEncoder.encode(temporaryPassword));
        s.setProgramme(body.programme() == null ? "SCIENCE" : body.programme());
        s.setYear(body.year());
        s.setSchool(school);
        if (body.classId() != null) {
            SchoolClass c = requireClass(school, body.classId());
            s.setSchoolClass(c);
            if (c.getSchool() != null) {
                s.setSchool(c.getSchool());
            }
        }
        Student saved = students.save(s);
        Map<String, Object> out = studentDto(saved);
        // Shown once to the admin so they can pass the login on to the student.
        out.put("temporaryPassword", temporaryPassword);
        out.put("loginUsername", saved.getIndexNumber());
        return out;
    }

    @PutMapping("/students/{id}")
    public Map<String, Object> updateStudent(Authentication auth, @PathVariable Long id,
                                             @RequestBody StudentRequest body) {
        School school = current.currentSchool(auth);
        Student s = requireStudent(school, id);
        if (body.fullName() != null && !body.fullName().isBlank()) {
            s.setFullName(body.fullName().trim());
        }
        if (body.indexNumber() != null && !body.indexNumber().isBlank()
                && !body.indexNumber().trim().equals(s.getIndexNumber())) {
            require(students.findByIndexNumber(body.indexNumber().trim()).isEmpty(),
                    "Index number already exists: " + body.indexNumber());
            s.setIndexNumber(body.indexNumber().trim());
        }
        if (body.programme() != null) {
            s.setProgramme(body.programme());
        }
        if (body.year() != 0) {
            s.setYear(body.year());
        }
        if (body.classId() != null) {
            s.setSchoolClass(requireClass(school, body.classId()));
        }
        return studentDto(students.save(s));
    }

    @DeleteMapping("/students/{id}")
    public void deleteStudent(Authentication auth, @PathVariable Long id) {
        School school = current.currentSchool(auth);
        Student s = requireStudent(school, id);
        grades.deleteAll(grades.findByStudentId(id));
        reportCards.findByStudentId(id).forEach(reportCards::delete);
        students.delete(s);
    }

    // ---- Teachers ----
    @GetMapping("/teachers")
    public List<Map<String, Object>> listTeachers(Authentication auth) {
        School school = current.currentSchool(auth);
        return teachers.findBySchool(school).stream().map(this::teacherDto).toList();
    }

    /**
     * Create a teacher account. The password is optional: when omitted the
     * server generates a temporary password and returns it once in the
     * response, so the admin can pass the login on to the teacher (there
     * is no email sending). The password itself is only ever stored as a
     * BCrypt hash.
     */
    @PostMapping("/teachers")
    public Map<String, Object> createTeacher(Authentication auth, @RequestBody TeacherRequest body) {
        School school = current.currentSchool(auth);
        require(body.fullName() != null && !body.fullName().isBlank(), "Teacher name is required");
        require(body.email() != null && !body.email().isBlank() && body.email().contains("@"),
                "A valid teacher email is required");
        String email = body.email().trim();
        require(teachers.findByEmail(email).isEmpty() && admins.findByEmail(email).isEmpty(),
                "That email is already registered: " + email);
        String temporaryPassword = null;
        String password = body.password();
        if (password == null || password.isBlank()) {
            temporaryPassword = generateTemporaryPassword();
            password = temporaryPassword;
        }
        require(password.length() >= 6, "Password must be at least 6 characters");
        Teacher t = new Teacher();
        t.setFullName(body.fullName().trim());
        t.setEmail(email);
        t.setPassword(passwordEncoder.encode(password));
        t.setSubject(body.subject() == null ? "" : body.subject().trim());
        t.setSchool(school);
        Teacher saved = teachers.save(t);
        Map<String, Object> out = teacherDto(saved);
        out.put("loginUsername", saved.getEmail());
        if (temporaryPassword != null) {
            out.put("temporaryPassword", temporaryPassword);
        }
        return out;
    }

    @DeleteMapping("/teachers/{id}")
    public void deleteTeacher(Authentication auth, @PathVariable Long id) {
        School school = current.currentSchool(auth);
        Teacher t = requireTeacher(school, id);
        require(classes.findBySchool(school).stream()
                        .noneMatch(c -> c.getClassTeacher() != null
                                && c.getClassTeacher().getId().equals(id)),
                "Cannot delete a teacher who is a class teacher — assign another class teacher first");
        require(grades.findAll().stream().noneMatch(g -> g.getTeacher().getId().equals(id)),
                "Cannot delete a teacher who already has grades recorded");
        assignments.findByTeacher(t).forEach(assignments::delete);
        teachers.delete(t);
    }

    // ---- Subject assignments (who teaches what, where) ----
    @GetMapping("/assignments")
    public List<Map<String, Object>> listAssignments(Authentication auth) {
        School school = current.currentSchool(auth);
        List<Map<String, Object>> out = new ArrayList<>();
        for (SchoolClass c : classes.findBySchool(school)) {
            for (SubjectAssignment a : assignments.findBySchoolClass(c)) {
                out.add(assignmentDto(a));
            }
        }
        return out;
    }

    @PostMapping("/assignments")
    public Map<String, Object> createAssignment(Authentication auth, @RequestBody AssignmentRequest body) {
        School school = current.currentSchool(auth);
        Teacher teacher = requireTeacher(school, body.teacherId());
        Subject subject = requireSubject(school, body.subjectId());
        SchoolClass schoolClass = requireClass(school, body.classId());
        boolean exists = assignments.findBySchoolClass(schoolClass).stream()
                .anyMatch(a -> a.getTeacher().getId().equals(teacher.getId())
                        && a.getSubject().getId().equals(subject.getId()));
        require(!exists, "That teacher is already assigned to this subject in this class");
        SubjectAssignment a = new SubjectAssignment();
        a.setTeacher(teacher);
        a.setSubject(subject);
        a.setSchoolClass(schoolClass);
        return assignmentDto(assignments.save(a));
    }

    @DeleteMapping("/assignments/{id}")
    public void deleteAssignment(Authentication auth, @PathVariable Long id) {
        School school = current.currentSchool(auth);
        assignments.delete(requireAssignment(school, id));
    }

    // ---- Grading scales (ranges must not overlap, within this school) ----
    @GetMapping("/grading-scales")
    public List<Map<String, Object>> listScales(Authentication auth) {
        School school = current.currentSchool(auth);
        return current.scales(school).stream().map(this::scaleDto).toList();
    }

    @PostMapping("/grading-scales")
    public Map<String, Object> createScale(Authentication auth, @RequestBody ScaleRequest body) {
        School school = current.currentSchool(auth);
        validateScale(school, body.minScore(), body.maxScore(), null);
        GradingScale scale = new GradingScale(body.letter(), body.minScore(),
                body.maxScore(), body.remark());
        scale.setSchool(school);
        return scaleDto(scales.save(scale));
    }

    @PutMapping("/grading-scales/{id}")
    public Map<String, Object> updateScale(Authentication auth, @PathVariable Long id,
                                           @RequestBody ScaleRequest body) {
        School school = current.currentSchool(auth);
        GradingScale s = requireScale(school, id);
        validateScale(school, body.minScore(), body.maxScore(), id);
        s.setLetter(body.letter());
        s.setMinScore(body.minScore());
        s.setMaxScore(body.maxScore());
        s.setRemark(body.remark());
        return scaleDto(scales.save(s));
    }

    @DeleteMapping("/grading-scales/{id}")
    public void deleteScale(Authentication auth, @PathVariable Long id) {
        School school = current.currentSchool(auth);
        scales.delete(requireScale(school, id));
    }

    private void validateScale(School school, double min, double max, Long excludeId) {
        require(min <= max, "minScore must not exceed maxScore");
        boolean overlap = scales.findBySchool(school).stream()
                .filter(s -> excludeId == null || !excludeId.equals(s.getId()))
                .anyMatch(s -> min <= s.getMaxScore() && s.getMinScore() <= max);
        require(!overlap, "Grading scale range overlaps an existing range");
    }

    // ---- Users (never return password hashes) ----
    @GetMapping("/users")
    public List<Map<String, Object>> listUsers(Authentication auth) {
        School school = current.currentSchool(auth);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Teacher t : teachers.findBySchool(school)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("username", t.getEmail());
            m.put("fullName", t.getFullName());
            m.put("role", "TEACHER");
            out.add(m);
        }
        for (Admin a : admins.findBySchool(school)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("username", a.getEmail());
            m.put("fullName", a.getFullName());
            m.put("role", "ADMIN");
            out.add(m);
        }
        return out;
    }

    // ---- School profile ----
    @GetMapping("/school")
    public Map<String, Object> getSchool(Authentication auth) {
        return schoolDto(current.currentSchool(auth));
    }

    @PutMapping("/school")
    public Map<String, Object> updateSchool(Authentication auth, @RequestBody SchoolRequest body) {
        School school = current.currentSchool(auth);
        if (body.name() != null && !body.name().isBlank()) {
            school.setName(body.name().trim());
        }
        if (body.town() != null) {
            school.setTown(body.town().trim().isEmpty() ? null : body.town().trim());
        }
        if (body.region() != null) {
            school.setRegion(body.region());
        }
        if (body.address() != null) {
            school.setAddress(body.address());
        }
        if (body.email() != null) {
            school.setEmail(body.email());
        }
        if (body.phone() != null) {
            school.setPhone(body.phone());
        }
        return schoolDto(schools.save(school));
    }

    private Map<String, Object> schoolDto(School school) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", school.getId());
        m.put("name", school.getName());
        m.put("town", school.getTown());
        m.put("region", school.getRegion());
        m.put("address", school.getAddress());
        m.put("email", school.getEmail());
        m.put("phone", school.getPhone());
        m.put("demoSchool", school.isDemo());
        return m;
    }
}
