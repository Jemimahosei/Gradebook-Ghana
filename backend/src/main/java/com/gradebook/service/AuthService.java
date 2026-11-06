package com.gradebook.service;

import com.gradebook.dto.AuthResponse;
import com.gradebook.dto.LoginRequest;
import com.gradebook.dto.RegisterSchoolRequest;
import com.gradebook.model.Admin;
import com.gradebook.model.GradingScale;
import com.gradebook.model.School;
import com.gradebook.model.Student;
import com.gradebook.model.Subject;
import com.gradebook.model.Teacher;
import com.gradebook.repository.AdminRepository;
import com.gradebook.repository.GradingScaleRepository;
import com.gradebook.repository.SchoolRepository;
import com.gradebook.repository.StudentRepository;
import com.gradebook.repository.SubjectRepository;
import com.gradebook.repository.TeacherRepository;
import com.gradebook.security.JwtUtil;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Login and public school signup. The role is decided by the server from the
 * username, not trusted from the request: an all-digits username is a
 * student (index number); an email is an admin first, then a teacher.
 * Wrong credentials always fail with the same generic message (no "user
 * not found" vs "bad password" distinction). BadCredentialsException is
 * mapped to HTTP 401.
 *
 * Signup creates a School plus its first ADMIN and seeds the school with
 * the standard WAEC grading scale (A1–F9) and the standard subject list,
 * so a new school starts from a working gradebook instead of an empty one.
 * The new admin is logged in immediately (the response carries a token).
 */
@Service
public class AuthService {

    private final TeacherRepository teacherRepo;
    private final StudentRepository studentRepo;
    private final AdminRepository adminRepo;
    private final SchoolRepository schoolRepo;
    private final GradingScaleRepository scaleRepo;
    private final SubjectRepository subjectRepo;
    private final CurrentUserService current;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder encoder;

    public AuthService(TeacherRepository teacherRepo, StudentRepository studentRepo,
                       AdminRepository adminRepo, SchoolRepository schoolRepo,
                       GradingScaleRepository scaleRepo, SubjectRepository subjectRepo,
                       CurrentUserService current, JwtUtil jwtUtil, PasswordEncoder encoder) {
        this.teacherRepo = teacherRepo;
        this.studentRepo = studentRepo;
        this.adminRepo = adminRepo;
        this.schoolRepo = schoolRepo;
        this.scaleRepo = scaleRepo;
        this.subjectRepo = subjectRepo;
        this.current = current;
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
            School school = current.schoolOfStudent(student);
            return new AuthResponse(jwtUtil.generateToken(student.getIndexNumber(), "STUDENT"),
                    "STUDENT", student.getFullName(),
                    school.getId(), school.getName(), school.isDemo());
        }

        Optional<Admin> admin = adminRepo.findByEmail(username);
        if (admin.isPresent()) {
            if (!encoder.matches(password, admin.get().getPassword())) {
                throw new BadCredentialsException("Invalid credentials");
            }
            School school = current.schoolOfAdmin(admin.get());
            return new AuthResponse(jwtUtil.generateToken(admin.get().getEmail(), "ADMIN"),
                    "ADMIN", admin.get().getFullName(),
                    school.getId(), school.getName(), school.isDemo());
        }

        Teacher teacher = teacherRepo.findByEmail(username)
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        if (!encoder.matches(password, teacher.getPassword())) {
            throw new BadCredentialsException("Invalid credentials");
        }
        School school = current.schoolOfTeacher(teacher);
        return new AuthResponse(jwtUtil.generateToken(teacher.getEmail(), "TEACHER"),
                "TEACHER", teacher.getFullName(),
                school.getId(), school.getName(), school.isDemo());
    }

    /** Who is logged in (for clients whose stored session predates school info). */
    public Map<String, Object> me(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()
                || "anonymousUser".equals(auth.getName())) {
            throw new BadCredentialsException("Not logged in");
        }
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        boolean isTeacher = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_TEACHER"));
        String role = isAdmin ? "ADMIN" : isTeacher ? "TEACHER" : "STUDENT";
        School school = current.currentSchool(auth);
        String name;
        if (isAdmin) {
            name = current.currentAdmin(auth).getFullName();
        } else if (isTeacher) {
            name = current.currentTeacher(auth).getFullName();
        } else {
            name = current.currentStudent(auth).getFullName();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", name);
        out.put("role", role);
        out.put("schoolId", school.getId());
        out.put("schoolName", school.getName());
        out.put("demoSchool", school.isDemo());
        return out;
    }

    /**
     * Register a school and its first admin. Seeds the WAEC scale and the
     * standard subject list so the school can start adding classes,
     * teachers and students immediately.
     */
    @Transactional
    public AuthResponse registerSchool(RegisterSchoolRequest req) {
        String schoolName = req.getSchoolName() == null ? "" : req.getSchoolName().trim();
        String contactName = req.getContactName() == null ? "" : req.getContactName().trim();
        String email = req.getEmail() == null ? "" : req.getEmail().trim();
        String password = req.getPassword() == null ? "" : req.getPassword();
        String town = req.getTown() == null ? "" : req.getTown().trim();
        String region = req.getRegion() == null ? "" : req.getRegion().trim();
        if (schoolName.isEmpty()) {
            throw new IllegalArgumentException("School name is required");
        }
        if (contactName.isEmpty()) {
            throw new IllegalArgumentException("Contact person name is required");
        }
        if (email.isEmpty() || !email.contains("@")) {
            throw new IllegalArgumentException("A valid contact email is required");
        }
        if (password.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters");
        }
        if (adminRepo.findByEmail(email).isPresent() || teacherRepo.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("That email is already registered — try logging in instead");
        }

        School school = new School(schoolName, region.isEmpty() ? null : region);
        school.setTown(town.isEmpty() ? null : town);
        school.setEmail(email);
        school.setDemo(false);
        schoolRepo.save(school);

        Admin admin = new Admin();
        admin.setFullName(contactName);
        admin.setEmail(email);
        admin.setPassword(encoder.encode(password));
        admin.setSchool(school);
        adminRepo.save(admin);

        seedDefaultsForSchool(school);

        return new AuthResponse(jwtUtil.generateToken(admin.getEmail(), "ADMIN"),
                "ADMIN", admin.getFullName(),
                school.getId(), school.getName(), false);
    }

    /** WAEC A1–F9 scale + the standard subject list for a newly registered school. */
    public void seedDefaultsForSchool(School school) {
        for (GradingScale s : waecScaleRows()) {
            s.setSchool(school);
            scaleRepo.save(s);
        }
        for (Subject s : standardSubjects()) {
            s.setSchool(school);
            subjectRepo.save(s);
        }
    }

    /** The WAEC SHS scale (same bands as the demo seed). */
    public static List<GradingScale> waecScaleRows() {
        return List.of(
                new GradingScale("A1", 90, 100, "Excellent"),
                new GradingScale("B2", 80, 89, "Very Good"),
                new GradingScale("B3", 70, 79, "Good"),
                new GradingScale("C4", 60, 69, "Credit"),
                new GradingScale("C5", 55, 59, "Credit"),
                new GradingScale("C6", 50, 54, "Credit"),
                new GradingScale("D7", 45, 49, "Pass"),
                new GradingScale("E8", 40, 44, "Pass"),
                new GradingScale("F9", 0, 39, "Fail"));
    }

    /** The standard subject list: 3 core subjects plus programme electives. */
    public static List<Subject> standardSubjects() {
        List<Subject> out = new java.util.ArrayList<>();
        out.add(subject("Core Mathematics", "CORE", true));
        out.add(subject("English Language", "CORE", true));
        out.add(subject("Social Studies", "CORE", true));
        out.add(subject("Integrated Science", "SCIENCE", false));
        out.add(subject("Physics", "SCIENCE", false));
        out.add(subject("Chemistry", "SCIENCE", false));
        out.add(subject("Biology", "SCIENCE", false));
        out.add(subject("Elective Mathematics", "SCIENCE", false));
        out.add(subject("Literature", "ARTS", false));
        out.add(subject("History", "ARTS", false));
        out.add(subject("Economics", "ARTS", false));
        out.add(subject("Government", "ARTS", false));
        out.add(subject("Accounting", "BUSINESS", false));
        out.add(subject("Business Management", "BUSINESS", false));
        out.add(subject("Graphic Design", "VISUAL_ARTS", false));
        out.add(subject("Picture Making", "VISUAL_ARTS", false));
        out.add(subject("Textiles", "VISUAL_ARTS", false));
        return out;
    }

    private static Subject subject(String name, String programme, boolean isCore) {
        Subject s = new Subject();
        s.setName(name);
        s.setProgramme(programme);
        s.setCore(isCore);
        return s;
    }
}
