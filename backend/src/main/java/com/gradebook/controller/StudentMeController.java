package com.gradebook.controller;

import com.gradebook.config.GradebookProperties;
import com.gradebook.model.Grade;
import com.gradebook.model.Student;
import com.gradebook.repository.GradeRepository;
import com.gradebook.repository.StudentRepository;
import com.gradebook.service.CurrentUserService;
import com.gradebook.service.GradeService;
import com.gradebook.service.ReportCardService;
import com.gradebook.util.WaecGrading;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The student's own view: dashboard, results, report-card download.
 * Students only ever see their own published grades. Admins may pass
 * ?studentId= to view any student (for support / verification).
 */
@RestController
@RequestMapping("/api/student/me")
@PreAuthorize("hasAnyRole('STUDENT', 'ADMIN')")
public class StudentMeController {

    private final CurrentUserService current;
    private final StudentRepository students;
    private final GradeRepository grades;
    private final GradeService gradeService;
    private final ReportCardService reportCardService;
    private final GradebookProperties props;

    public StudentMeController(CurrentUserService current, StudentRepository students,
                               GradeRepository grades, GradeService gradeService,
                               ReportCardService reportCardService, GradebookProperties props) {
        this.current = current;
        this.students = students;
        this.grades = grades;
        this.gradeService = gradeService;
        this.reportCardService = reportCardService;
        this.props = props;
    }

    private Student resolveStudent(Authentication auth, Long studentIdParam) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (isAdmin) {
            // An admin may only view students of their own school.
            com.gradebook.model.School school = current.currentSchool(auth);
            if (studentIdParam != null) {
                return students.findById(studentIdParam)
                        .filter(s -> current.sameSchool(current.schoolOfStudent(s), school))
                        .orElseThrow(() -> new java.util.NoSuchElementException(
                                "Student not found: " + studentIdParam));
            }
            return students.findBySchool(school).stream().findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("No students found"));
        }
        Student me = current.currentStudent(auth);
        if (studentIdParam != null && !studentIdParam.equals(me.getId())) {
            throw new IllegalArgumentException("Students may only access their own records");
        }
        return me;
    }

    private List<Grade> publishedGrades(Student student) {
        String semester = props.semester();
        return gradeService.getPublishedGrades(student.getId()).stream()
                .filter(g -> semester.equals(g.getSemester()))
                .sorted(Comparator.comparing(g -> g.getSubject().getName()))
                .toList();
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(Authentication auth,
                                         @RequestParam(required = false) Long studentId) {
        Student student = resolveStudent(auth, studentId);
        com.gradebook.model.School school = current.schoolOfStudent(student);
        String semester = props.semester();
        List<Grade> published = publishedGrades(student);
        Double overall = WaecGrading.average(published.stream().map(Grade::getScore).toList());
        Integer rank = gradeService.classRank(student.getId(), semester);
        int classSize = student.getSchoolClass() == null ? 0
                : students.findBySchoolClass(student.getSchoolClass()).size();

        Map<String, List<Grade>> bySubject = new LinkedHashMap<>();
        for (Grade g : published) {
            bySubject.computeIfAbsent(g.getSubject().getName(), k -> new ArrayList<>()).add(g);
        }
        List<Map<String, Object>> subjectAverages = new ArrayList<>();
        for (Map.Entry<String, List<Grade>> e : bySubject.entrySet()) {
            Double avg = WaecGrading.average(e.getValue().stream().map(Grade::getScore).toList());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("subject", e.getKey());
            m.put("average", avg);
            m.put("letter", avg == null ? null : current.letterFor(school, avg));
            subjectAverages.add(m);
        }

        Map<String, Object> studentDto = new LinkedHashMap<>();
        studentDto.put("id", student.getId());
        studentDto.put("fullName", student.getFullName());
        studentDto.put("indexNumber", student.getIndexNumber());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("student", studentDto);
        result.put("className", student.getSchoolClass() == null ? null : student.getSchoolClass().getName());
        result.put("overallAverage", overall);
        result.put("classRank", rank);
        result.put("classSize", classSize);
        result.put("subjectAverages", subjectAverages);
        result.put("semester", semester);
        return result;
    }

    @GetMapping("/results")
    public List<Map<String, Object>> results(Authentication auth,
                                             @RequestParam(required = false) Long studentId) {
        Student student = resolveStudent(auth, studentId);
        com.gradebook.model.School school = current.schoolOfStudent(student);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Grade g : publishedGrades(student)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("subject", g.getSubject().getName());
            m.put("classScore", g.getClassScore());
            m.put("examScore", g.getExamScore());
            m.put("total", g.getScore());
            m.put("letter", g.getScore() == null ? null : current.letterFor(school, g.getScore()));
            m.put("remark", g.getScore() == null ? null : current.remarkFor(school, g.getScore()));
            m.put("published", g.isPublished());
            rows.add(m);
        }
        return rows;
    }

    @GetMapping("/report-card")
    public ResponseEntity<byte[]> reportCard(Authentication auth,
                                             @RequestParam(required = false, defaultValue = "pdf") String format,
                                             @RequestParam(required = false) Long studentId) throws Exception {
        Student student = resolveStudent(auth, studentId);
        com.gradebook.model.School school = current.schoolOfStudent(student);
        String semester = props.semester();
        List<Grade> published = publishedGrades(student);
        if (published.isEmpty()) {
            throw new IllegalArgumentException("No published grades yet for this student");
        }
        List<ReportCardService.ResultRow> rows = published.stream().map(g ->
                new ReportCardService.ResultRow(
                        g.getSubject().getName(), g.getClassScore(), g.getExamScore(), g.getScore(),
                        g.getScore() == null ? null : current.letterFor(school, g.getScore()),
                        g.getScore() == null ? null : current.remarkFor(school, g.getScore()))).toList();
        Double overall = WaecGrading.average(published.stream().map(Grade::getScore).toList());
        Integer rank = gradeService.classRank(student.getId(), semester);
        int classSize = student.getSchoolClass() == null ? 0
                : students.findBySchoolClass(student.getSchoolClass()).size();
        String filenameBase = "report-card-" + student.getIndexNumber();

        if ("pdf".equalsIgnoreCase(format)) {
            byte[] pdf = reportCardService.toPdf(student, school.getName(),
                    student.getSchoolClass() == null ? "" : student.getSchoolClass().getName(),
                    "Term 1, " + semester, rows, overall, rank, classSize, school.isDemo());
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            ContentDisposition.attachment().filename(filenameBase + ".pdf").build().toString())
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdf);
        }
        if ("csv".equalsIgnoreCase(format)) {
            byte[] csv = reportCardService.toCsv(rows).getBytes(StandardCharsets.UTF_8);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            ContentDisposition.attachment().filename(filenameBase + ".csv").build().toString())
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(csv);
        }
        throw new IllegalArgumentException("format must be 'pdf' or 'csv'");
    }
}
