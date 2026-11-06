package com.gradebook.controller;

import com.gradebook.model.Admin;
import com.gradebook.model.GradingScale;
import com.gradebook.model.School;
import com.gradebook.model.SchoolClass;
import com.gradebook.model.Student;
import com.gradebook.model.Subject;
import com.gradebook.model.Teacher;
import com.gradebook.repository.AdminRepository;
import com.gradebook.repository.GradeRepository;
import com.gradebook.repository.GradingScaleRepository;
import com.gradebook.repository.SchoolClassRepository;
import com.gradebook.repository.SchoolRepository;
import com.gradebook.repository.StudentRepository;
import com.gradebook.repository.SubjectRepository;
import com.gradebook.repository.TeacherRepository;
import com.gradebook.service.CurrentUserService;
import com.gradebook.util.WaecGrading;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin portal endpoints (Academic Head): dashboard counts, class /
 * subject / student CRUD, grading-scale management, user list, and the
 * school profile. ADMIN role only.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final CurrentUserService current;
    private final SchoolClassRepository classes;
    private final SubjectRepository subjects;
    private final StudentRepository students;
    private final GradingScaleRepository scales;
    private final TeacherRepository teachers;
    private final AdminRepository admins;
    private final SchoolRepository schools;
    private final GradeRepository grades;
    private final PasswordEncoder passwordEncoder;

    public AdminController(CurrentUserService current, SchoolClassRepository classes,
                           SubjectRepository subjects, StudentRepository students,
                           GradingScaleRepository scales, TeacherRepository teachers,
                           AdminRepository admins, SchoolRepository schools, GradeRepository grades,
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
    public record ScaleRequest(String letter, double minScore, double maxScore, String remark) {
    }
    public record SchoolRequest(String name, String region, String address, String email, String phone) {
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

    private Map<String, Object> scaleDto(GradingScale s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("letter", s.getLetter());
        m.put("minScore", s.getMinScore());
        m.put("maxScore", s.getMaxScore());
        m.put("remark", s.getRemark());
        return m;
    }

    private SchoolClass requireClass(Long id) {
        return classes.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Class not found: " + id));
    }

    private Subject requireSubject(Long id) {
        return subjects.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Subject not found: " + id));
    }

    private Student requireStudent(Long id) {
        return students.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Student not found: " + id));
    }

    private GradingScale requireScale(Long id) {
        return scales.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Grading scale not found: " + id));
    }

    private void require(boolean ok, String message) {
        if (!ok) {
            throw new IllegalArgumentException(message);
        }
    }

    // ---- Dashboard ----
    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        List<Map<String, Object>> summaries = new ArrayList<>();
        for (SchoolClass c : classes.findAll()) {
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
        result.put("studentCount", students.count());
        result.put("teacherCount", teachers.count());
        result.put("classCount", classes.count());
        result.put("subjectCount", subjects.count());
        result.put("assessmentCount", 0); // no assessment model in this prototype
        result.put("classSummaries", summaries);
        return result;
    }

    // ---- Classes ----
    @GetMapping("/classes")
    public List<Map<String, Object>> listClasses() {
        return classes.findAll().stream().map(this::classDto).toList();
    }

    @PostMapping("/classes")
    public Map<String, Object> createClass(@RequestBody ClassRequest body) {
        require(body.name() != null && !body.name().isBlank(), "Class name is required");
        SchoolClass c = new SchoolClass();
        c.setName(body.name().trim());
        c.setProgramme(body.programme() == null ? "SCIENCE" : body.programme());
        c.setFormYear(body.formYear());
        if (body.classTeacherId() != null) {
            c.setClassTeacher(teachers.findById(body.classTeacherId())
                    .orElseThrow(() -> new IllegalArgumentException("Teacher not found: " + body.classTeacherId())));
        }
        return classDto(classes.save(c));
    }

    @PutMapping("/classes/{id}")
    public Map<String, Object> updateClass(@PathVariable Long id, @RequestBody ClassRequest body) {
        SchoolClass c = requireClass(id);
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
            c.setClassTeacher(teachers.findById(body.classTeacherId())
                    .orElseThrow(() -> new IllegalArgumentException("Teacher not found: " + body.classTeacherId())));
        }
        return classDto(classes.save(c));
    }

    @DeleteMapping("/classes/{id}")
    public void deleteClass(@PathVariable Long id) {
        SchoolClass c = requireClass(id);
        require(students.findBySchoolClass(c).isEmpty(),
                "Cannot delete a class that still has students — move or remove them first");
        classes.delete(c);
    }

    // ---- Subjects ----
    @GetMapping("/subjects")
    public List<Map<String, Object>> listSubjects() {
        return subjects.findAll().stream().map(this::subjectDto).toList();
    }

    @PostMapping("/subjects")
    public Map<String, Object> createSubject(@RequestBody SubjectRequest body) {
        require(body.name() != null && !body.name().isBlank(), "Subject name is required");
        Subject s = new Subject();
        s.setName(body.name().trim());
        s.setProgramme(body.programme() == null ? "CORE" : body.programme());
        s.setCore(body.isCore());
        return subjectDto(subjects.save(s));
    }

    @PutMapping("/subjects/{id}")
    public Map<String, Object> updateSubject(@PathVariable Long id, @RequestBody SubjectRequest body) {
        Subject s = requireSubject(id);
        if (body.name() != null && !body.name().isBlank()) {
            s.setName(body.name().trim());
        }
        if (body.programme() != null) {
            s.setProgramme(body.programme());
        }
        s.setCore(body.isCore());
        return subjectDto(subjects.save(s));
    }

    @DeleteMapping("/subjects/{id}")
    public void deleteSubject(@PathVariable Long id) {
        subjects.delete(requireSubject(id));
    }

    // ---- Students ----
    @GetMapping("/students")
    public List<Map<String, Object>> listStudents() {
        return students.findAll().stream().map(this::studentDto).toList();
    }

    @PostMapping("/students")
    public Map<String, Object> createStudent(@RequestBody StudentRequest body) {
        require(body.fullName() != null && !body.fullName().isBlank(), "Student name is required");
        require(body.indexNumber() != null && !body.indexNumber().isBlank(), "Index number is required");
        require(students.findByIndexNumber(body.indexNumber().trim()).isEmpty(),
                "Index number already exists: " + body.indexNumber());
        Student s = new Student();
        s.setFullName(body.fullName().trim());
        s.setIndexNumber(body.indexNumber().trim());
        // Students created by the admin get the demo password until the
        // teacher changes it; the login page shows the demo accounts.
        s.setPassword(currentPasswordHash());
        s.setProgramme(body.programme() == null ? "SCIENCE" : body.programme());
        s.setYear(body.year());
        if (body.classId() != null) {
            s.setSchoolClass(requireClass(body.classId()));
        }
        return studentDto(students.save(s));
    }

    @PutMapping("/students/{id}")
    public Map<String, Object> updateStudent(@PathVariable Long id, @RequestBody StudentRequest body) {
        Student s = requireStudent(id);
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
            s.setSchoolClass(requireClass(body.classId()));
        }
        return studentDto(students.save(s));
    }

    @DeleteMapping("/students/{id}")
    public void deleteStudent(@PathVariable Long id) {
        students.delete(requireStudent(id));
    }

    // ---- Grading scales (ranges must not overlap) ----
    @GetMapping("/grading-scales")
    public List<Map<String, Object>> listScales() {
        return scales.findAllByOrderByMinScoreDesc().stream().map(this::scaleDto).toList();
    }

    @PostMapping("/grading-scales")
    public Map<String, Object> createScale(@RequestBody ScaleRequest body) {
        validateScale(body.minScore(), body.maxScore(), null);
        return scaleDto(scales.save(new GradingScale(body.letter(), body.minScore(),
                body.maxScore(), body.remark())));
    }

    @PutMapping("/grading-scales/{id}")
    public Map<String, Object> updateScale(@PathVariable Long id, @RequestBody ScaleRequest body) {
        GradingScale s = requireScale(id);
        validateScale(body.minScore(), body.maxScore(), id);
        s.setLetter(body.letter());
        s.setMinScore(body.minScore());
        s.setMaxScore(body.maxScore());
        s.setRemark(body.remark());
        return scaleDto(scales.save(s));
    }

    @DeleteMapping("/grading-scales/{id}")
    public void deleteScale(@PathVariable Long id) {
        scales.delete(requireScale(id));
    }

    private void validateScale(double min, double max, Long excludeId) {
        require(min <= max, "minScore must not exceed maxScore");
        boolean overlap = scales.findAll().stream()
                .filter(s -> excludeId == null || !excludeId.equals(s.getId()))
                .anyMatch(s -> min <= s.getMaxScore() && s.getMinScore() <= max);
        require(!overlap, "Grading scale range overlaps an existing range");
    }

    // ---- Users (never return password hashes) ----
    @GetMapping("/users")
    public List<Map<String, Object>> listUsers() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Teacher t : teachers.findAll()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("username", t.getEmail());
            m.put("fullName", t.getFullName());
            m.put("role", "TEACHER");
            out.add(m);
        }
        for (Admin a : admins.findAll()) {
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
    public Map<String, Object> getSchool() {
        return schoolDto(current.demoSchool());
    }

    @PutMapping("/school")
    public Map<String, Object> updateSchool(@RequestBody SchoolRequest body) {
        School school = current.demoSchool();
        if (body.name() != null && !body.name().isBlank()) {
            school.setName(body.name().trim());
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
        m.put("region", school.getRegion());
        m.put("address", school.getAddress());
        m.put("email", school.getEmail());
        m.put("phone", school.getPhone());
        return m;
    }

    private String currentPasswordHash() {
        // New students get the demo password until the teacher changes it.
        return passwordEncoder.encode("demo123");
    }
}
