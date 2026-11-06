package com.gradebook.service;

import com.gradebook.config.GradebookProperties;
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
import com.gradebook.repository.SchoolClassRepository;
import com.gradebook.repository.SchoolRepository;
import com.gradebook.repository.StudentRepository;
import com.gradebook.repository.SubjectAssignmentRepository;
import com.gradebook.repository.SubjectRepository;
import com.gradebook.repository.TeacherRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Idempotent demo seed: only seeds when no teachers exist.
 * All data is fictional demo data for "Demo Senior High School" — not a
 * real school, and no real student's data is used anywhere.
 *
 * Demo logins (password demo123 for all three):
 *   Admin   admin@demo
 *   Teacher teacher@demo   (Mrs. Asante — class teacher of 2 Arts 1, which
 *                           starts empty so the enter-marks flow can be demoed)
 *   Student 0050101001     (Kwame Mensah, 3 Science 4 — has published grades
 *                           so the report card works immediately)
 */
@Component
@Order(2)
public class DataSeeder implements CommandLineRunner {

    private final TeacherRepository teacherRepo;
    private final StudentRepository studentRepo;
    private final SubjectRepository subjectRepo;
    private final SchoolClassRepository classRepo;
    private final SubjectAssignmentRepository assignmentRepo;
    private final AdminRepository adminRepo;
    private final GradingScaleRepository scaleRepo;
    private final SchoolRepository schoolRepo;
    private final GradeRepository gradeRepo;
    private final PasswordEncoder encoder;
    private final GradebookProperties props;

    /** The school being seeded — every seeded row belongs to it. */
    private School seedSchool;

    public DataSeeder(TeacherRepository teacherRepo, StudentRepository studentRepo,
                      SubjectRepository subjectRepo, SchoolClassRepository classRepo,
                      SubjectAssignmentRepository assignmentRepo, AdminRepository adminRepo,
                      GradingScaleRepository scaleRepo, SchoolRepository schoolRepo,
                      GradeRepository gradeRepo, PasswordEncoder encoder,
                      GradebookProperties props) {
        this.teacherRepo = teacherRepo;
        this.studentRepo = studentRepo;
        this.subjectRepo = subjectRepo;
        this.classRepo = classRepo;
        this.assignmentRepo = assignmentRepo;
        this.adminRepo = adminRepo;
        this.scaleRepo = scaleRepo;
        this.schoolRepo = schoolRepo;
        this.gradeRepo = gradeRepo;
        this.encoder = encoder;
        this.props = props;
    }

    @Override
    public void run(String... args) {
        if (teacherRepo.count() > 0) {
            return; // already seeded
        }
        String demoHash = encoder.encode("demo123");
        String semester = props.semester();

        // --- School ---
        School school = new School("Demo Senior High School", "Ashanti Region");
        school.setDemo(true);
        schoolRepo.save(school);
        seedSchool = school;

        // --- WAEC grading scale (admin-editable; these are the defaults) ---
        for (GradingScale s : AuthService.waecScaleRows()) {
            s.setSchool(school);
            scaleRepo.save(s);
        }

        // --- Admin ---
        Admin admin = new Admin();
        admin.setFullName("Demo Admin");
        admin.setEmail("admin@demo");
        admin.setPassword(demoHash);
        admin.setSchool(school);
        adminRepo.save(admin);

        // --- Teachers ---
        Teacher asante = teacher("Mrs. Asante", "teacher@demo", "Integrated Science", demoHash);
        Teacher mensah = teacher("Mr. Mensah", "mensah@demo", "Elective Mathematics", demoHash);
        Teacher osei = teacher("Ms. Osei", "osei@demo", "Accounting", demoHash);
        Teacher boateng = teacher("Mr. Boateng", "boateng@demo", "Graphic Design", demoHash);

        // --- Classes (the screenshot class names, plus a Visual Arts class) ---
        SchoolClass arts1 = schoolClass("2 Arts 1", "ARTS", 2, asante);
        SchoolClass science4 = schoolClass("3 Science 4", "SCIENCE", 3, mensah);
        SchoolClass business2 = schoolClass("1 Business 2", "BUSINESS", 1, osei);
        SchoolClass visual1 = schoolClass("1 Visual Arts 1", "VISUAL_ARTS", 1, boateng);

        // --- Subjects ---
        Subject coreMaths = subject("Core Mathematics", "CORE", true);
        Subject english = subject("English Language", "CORE", true);
        Subject socialStudies = subject("Social Studies", "CORE", true);
        Subject intScience = subject("Integrated Science", "SCIENCE", false);
        Subject physics = subject("Physics", "SCIENCE", false);
        Subject chemistry = subject("Chemistry", "SCIENCE", false);
        Subject biology = subject("Biology", "SCIENCE", false);
        Subject elecMaths = subject("Elective Mathematics", "SCIENCE", false);
        Subject literature = subject("Literature", "ARTS", false);
        Subject history = subject("History", "ARTS", false);
        Subject economics = subject("Economics", "ARTS", false);
        Subject government = subject("Government", "ARTS", false);
        Subject accounting = subject("Accounting", "BUSINESS", false);
        Subject businessMgmt = subject("Business Management", "BUSINESS", false);
        Subject graphicDesign = subject("Graphic Design", "VISUAL_ARTS", false);
        Subject pictureMaking = subject("Picture Making", "VISUAL_ARTS", false);
        Subject textiles = subject("Textiles", "VISUAL_ARTS", false);

        // Subjects per class (core + programme electives)
        Map<SchoolClass, List<Subject>> classSubjects = new LinkedHashMap<>();
        classSubjects.put(arts1, List.of(coreMaths, english, socialStudies,
                literature, history, economics, government));
        classSubjects.put(science4, List.of(coreMaths, english, socialStudies,
                intScience, physics, chemistry, biology, elecMaths));
        classSubjects.put(business2, List.of(coreMaths, english, socialStudies,
                accounting, economics, businessMgmt));
        classSubjects.put(visual1, List.of(coreMaths, english, socialStudies,
                graphicDesign, pictureMaking, textiles));

        // Class teacher teaches every subject of their class.
        for (Map.Entry<SchoolClass, List<Subject>> e : classSubjects.entrySet()) {
            Teacher classTeacher = e.getKey().getClassTeacher();
            for (Subject s : e.getValue()) {
                assign(classTeacher, s, e.getKey());
            }
        }
        // Asante also teaches Integrated Science in 3 Science 4 (so her
        // "My Subjects" tab shows a second class).
        assign(asante, intScience, science4);

        // --- Students: 8 per class, fictional names, digits-only index numbers ---
        // Science class first so the demo student (0050101001) is in it.
        List<Student> scienceStudents = students(science4, "SCIENCE", 3,
                new String[][]{
                        {"Kwame Mensah", "0050101001"}, {"Abena Osei", "0050101002"},
                        {"Kofi Acheampong", "0050101003"}, {"Akosua Boateng", "0050101004"},
                        {"Yaw Darko", "0050101005"}, {"Ama Asare", "0050101006"},
                        {"Kwesi Amponsah", "0050101007"}, {"Adwoa Frimpong", "0050101008"}},
                demoHash);
        students(arts1, "ARTS", 2,
                new String[][]{
                        {"Akosua Mensah", "0050101009"}, {"Kwame Owusu", "0050101010"},
                        {"Abena Boateng", "0050101011"}, {"Yaw Asante", "0050101012"},
                        {"Adwoa Frimpong", "0050101013"}, {"Kofi Adjei", "0050101014"},
                        {"Akua Nyarko", "0050101015"}, {"Kwabena Appiah", "0050101016"}},
                demoHash);
        students(business2, "BUSINESS", 1,
                new String[][]{
                        {"Ama Darko", "0050101017"}, {"Kojo Mensah", "0050101018"},
                        {"Efua Osei", "0050101019"}, {"Kwaku Boateng", "0050101020"},
                        {"Abena Owusu", "0050101021"}, {"Yaw Mensah", "0050101022"},
                        {"Akosua Asante", "0050101023"}, {"Kofi Boateng", "0050101024"}},
                demoHash);
        students(visual1, "VISUAL_ARTS", 1,
                new String[][]{
                        {"Adjoa Owusu", "0050101025"}, {"Kwame Asante", "0050101026"},
                        {"Ama Appiah", "0050101027"}, {"Yaw Osei", "0050101028"},
                        {"Akua Mensah", "0050101029"}, {"Kojo Asante", "0050101030"},
                        {"Efua Boateng", "0050101031"}, {"Kwabena Osei", "0050101032"}},
                demoHash);

        // --- Seeded grades: 3 Science 4 only, published, so the student demo
        // login immediately shows a full report card. The other three classes
        // start empty — the teacher enters their first marks live. ---
        List<Subject> sciSubjects = classSubjects.get(science4);
        for (int i = 0; i < scienceStudents.size(); i++) {
            for (int s = 0; s < sciSubjects.size(); s++) {
                Grade g = new Grade();
                g.setStudent(scienceStudents.get(i));
                g.setSubject(sciSubjects.get(s));
                g.setTeacher(mensah);
                g.setClassScore((double) variedScore(i, s, 0));
                g.setExamScore((double) variedScore(i, s, 1));
                g.setSemester(semester);
                g.setPublished(true);
                gradeRepo.save(g);
            }
        }

        System.out.println("Seeded Demo Senior High School: 4 classes, 32 students, "
                + "4 teachers, 1 admin, WAEC scale, published grades for 3 Science 4");
    }

    private Teacher teacher(String fullName, String email, String subject, String hash) {
        Teacher t = new Teacher();
        t.setFullName(fullName);
        t.setEmail(email);
        t.setPassword(hash);
        t.setSubject(subject);
        t.setSchool(seedSchool);
        return teacherRepo.save(t);
    }

    private SchoolClass schoolClass(String name, String programme, int formYear, Teacher classTeacher) {
        SchoolClass sc = new SchoolClass();
        sc.setName(name);
        sc.setProgramme(programme);
        sc.setFormYear(formYear);
        sc.setClassTeacher(classTeacher);
        sc.setSchool(seedSchool);
        return classRepo.save(sc);
    }

    private Subject subject(String name, String programme, boolean isCore) {
        Subject s = new Subject();
        s.setName(name);
        s.setProgramme(programme);
        s.setCore(isCore);
        s.setSchool(seedSchool);
        return subjectRepo.save(s);
    }

    private void assign(Teacher teacher, Subject subject, SchoolClass schoolClass) {
        SubjectAssignment a = new SubjectAssignment();
        a.setTeacher(teacher);
        a.setSubject(subject);
        a.setSchoolClass(schoolClass);
        assignmentRepo.save(a);
    }

    private List<Student> students(SchoolClass schoolClass, String programme, int year,
                                   String[][] names, String hash) {
        List<Student> out = new ArrayList<>();
        for (String[] n : names) {
            Student st = new Student();
            st.setFullName(n[0]);
            st.setIndexNumber(n[1]);
            st.setPassword(hash);
            st.setProgramme(programme);
            st.setYear(year);
            st.setSchoolClass(schoolClass);
            st.setSchool(seedSchool);
            out.add(studentRepo.save(st));
        }
        return out;
    }

    /** Deterministic varied realistic scores (18-99, with occasional lower marks). */
    private int variedScore(int studentIdx, int subjectIdx, int typeIdx) {
        int score = 52 + ((studentIdx * 17 + subjectIdx * 11 + typeIdx * 7) % 46);
        if ((studentIdx + subjectIdx + typeIdx) % 9 == 0) {
            score -= 20;
        }
        return Math.max(18, Math.min(99, score));
    }
}
