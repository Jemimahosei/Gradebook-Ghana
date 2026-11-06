package com.gradebook.controller;

import com.gradebook.config.GradebookProperties;
import com.gradebook.model.Grade;
import com.gradebook.model.SchoolClass;
import com.gradebook.model.Student;
import com.gradebook.model.Subject;
import com.gradebook.model.SubjectAssignment;
import com.gradebook.model.Teacher;
import com.gradebook.repository.GradeRepository;
import com.gradebook.repository.SchoolClassRepository;
import com.gradebook.repository.StudentRepository;
import com.gradebook.repository.SubjectAssignmentRepository;
import com.gradebook.repository.SubjectRepository;
import com.gradebook.repository.TeacherRepository;
import com.gradebook.service.GradeService;
import com.gradebook.util.RankingUtil;
import com.gradebook.util.WaecGrading;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Teacher endpoints. Role-enforced: TEACHER or ADMIN (an admin sees
 * isClassTeacher=false and no class of their own).
 */
@RestController
@RequestMapping("/api/teacher")
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class TeacherController {

    private final TeacherRepository teacherRepo;
    private final SchoolClassRepository classRepo;
    private final SubjectAssignmentRepository assignmentRepo;
    private final StudentRepository studentRepo;
    private final GradeRepository gradeRepo;
    private final SubjectRepository subjectRepo;
    private final GradeService gradeService;
    private final GradebookProperties props;

    public TeacherController(TeacherRepository teacherRepo, SchoolClassRepository classRepo,
                             SubjectAssignmentRepository assignmentRepo, StudentRepository studentRepo,
                             GradeRepository gradeRepo, SubjectRepository subjectRepo,
                             GradeService gradeService, GradebookProperties props) {
        this.teacherRepo = teacherRepo;
        this.classRepo = classRepo;
        this.assignmentRepo = assignmentRepo;
        this.studentRepo = studentRepo;
        this.gradeRepo = gradeRepo;
        this.subjectRepo = subjectRepo;
        this.gradeService = gradeService;
        this.props = props;
    }

    private Optional<Teacher> getTeacher(Authentication auth) {
        return teacherRepo.findByEmail(auth.getName());
    }

    // --- My Class: full grade sheet for the class this teacher is class teacher of ---
    @GetMapping("/my-class")
    public Map<String, Object> getMyClass(Authentication auth) {
        Optional<Teacher> teacherOpt = getTeacher(auth);
        if (teacherOpt.isEmpty()) {
            return Map.of("isClassTeacher", false);
        }
        Teacher teacher = teacherOpt.get();
        Optional<SchoolClass> classOpt = classRepo.findByClassTeacher(teacher);
        if (classOpt.isEmpty()) {
            return Map.of("isClassTeacher", false);
        }
        SchoolClass sc = classOpt.get();
        String semester = props.semester();
        List<Student> students = studentRepo.findBySchoolClass(sc);
        List<Grade> grades = gradeRepo.findBySchoolClassAndSemester(sc, semester);

        List<SubjectAssignment> assignments = assignmentRepo.findBySchoolClass(sc);
        List<String> subjects = assignments.stream()
                .map(a -> a.getSubject().getName())
                .distinct()
                .sorted()
                .toList();

        // Map studentId -> subjectName -> {classScore, examScore, total}
        Map<Long, Map<String, Map<String, Object>>> gradeMap = new HashMap<>();
        for (Grade g : grades) {
            Map<String, Object> cell = new LinkedHashMap<>();
            cell.put("classScore", g.getClassScore());
            cell.put("examScore", g.getExamScore());
            cell.put("total", g.getScore());
            gradeMap.computeIfAbsent(g.getStudent().getId(), k -> new HashMap<>())
                    .put(g.getSubject().getName(), cell);
        }

        // Student averages (mean of subject totals; null when no complete grades)
        Map<Long, Double> averages = new HashMap<>();
        for (Student st : students) {
            List<Double> totals = grades.stream()
                    .filter(g -> g.getStudent().getId().equals(st.getId()))
                    .map(Grade::getScore)
                    .toList();
            averages.put(st.getId(), WaecGrading.average(totals));
        }

        // "1224" ranks — ties share a rank, the next rank skips.
        Map<Long, Integer> ranks = new HashMap<>();
        for (RankingUtil.RankedEntry e : gradeService.classRankings(sc, semester)) {
            ranks.put(e.studentId(), e.rank());
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Student st : students) {
            Map<String, Double> sg = new HashMap<>(); // kept for backwards compat (subject -> total)
            Map<String, Map<String, Object>> cells = gradeMap.getOrDefault(st.getId(), Map.of());
            for (Map.Entry<String, Map<String, Object>> e : cells.entrySet()) {
                Object total = e.getValue().get("total");
                if (total instanceof Number n) {
                    sg.put(e.getKey(), n.doubleValue());
                }
            }
            Double avg = averages.get(st.getId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", st.getId());
            row.put("fullName", st.getFullName());
            row.put("indexNumber", st.getIndexNumber());
            row.put("grades", sg);
            row.put("gradeCells", cells);
            row.put("average", avg);
            row.put("grade", avg == null ? "-" : WaecGrading.letter(avg));
            row.put("rank", ranks.get(st.getId()));
            row.put("published", grades.stream()
                    .filter(g -> g.getStudent().getId().equals(st.getId()))
                    .anyMatch(Grade::isPublished));
            rows.add(row);
        }
        // Display order: ranked first (by average desc), unranked last, name order within ties.
        rows.sort((a, b) -> {
            Integer ra = (Integer) a.get("rank");
            Integer rb = (Integer) b.get("rank");
            if (ra == null && rb == null) {
                return ((String) a.get("fullName")).compareTo((String) b.get("fullName"));
            }
            if (ra == null) return 1;
            if (rb == null) return -1;
            int cmp = Integer.compare(ra, rb);
            return cmp != 0 ? cmp : ((String) a.get("fullName")).compareTo((String) b.get("fullName"));
        });

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("isClassTeacher", true);
        result.put("className", sc.getName());
        result.put("programme", sc.getProgramme());
        result.put("subjects", subjects);
        result.put("students", rows);
        result.put("semester", semester);
        return result;
    }

    // --- My Subjects: classes where this teacher is a subject teacher ---
    @GetMapping("/my-subjects")
    public List<Map<String, Object>> getMySubjects(Authentication auth) {
        Optional<Teacher> teacherOpt = getTeacher(auth);
        if (teacherOpt.isEmpty()) {
            return List.of();
        }
        List<SubjectAssignment> assignments = assignmentRepo.findByTeacher(teacherOpt.get());
        List<Map<String, Object>> result = new ArrayList<>();
        for (SubjectAssignment a : assignments) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("classId", a.getSchoolClass().getId());
            m.put("className", a.getSchoolClass().getName());
            m.put("subjectId", a.getSubject().getId());
            m.put("subjectName", a.getSubject().getName());
            result.add(m);
        }
        return result;
    }

    // --- Class rankings ("1224") for the teacher's own class ---
    @GetMapping("/rankings")
    public List<Map<String, Object>> getRankings(Authentication auth) {
        Optional<Teacher> teacherOpt = getTeacher(auth);
        if (teacherOpt.isEmpty()) {
            return List.of();
        }
        SchoolClass sc = classRepo.findByClassTeacher(teacherOpt.get())
                .orElseThrow(() -> new IllegalArgumentException("Not a class teacher"));
        List<Map<String, Object>> result = new ArrayList<>();
        for (RankingUtil.RankedEntry e : gradeService.classRankings(sc, props.semester())) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("rank", e.rank());
            m.put("studentId", e.studentId());
            m.put("studentName", e.studentName());
            m.put("average", e.average());
            m.put("grade", WaecGrading.letter(e.average()));
            result.add(m);
        }
        return result;
    }

    // --- Publish all grades for the class teacher's class ---
    @PostMapping("/publish")
    public Map<String, String> publishGrades(Authentication auth) {
        Teacher teacher = getTeacher(auth)
                .orElseThrow(() -> new IllegalArgumentException("Not a teacher"));
        SchoolClass sc = classRepo.findByClassTeacher(teacher)
                .orElseThrow(() -> new IllegalArgumentException("Not a class teacher"));
        List<Grade> grades = gradeRepo.findBySchoolClassAndSemester(sc, props.semester());
        grades.forEach(g -> g.setPublished(true));
        gradeRepo.saveAll(grades);
        return Map.of("status", "published", "count", String.valueOf(grades.size()));
    }

    // --- Subjects (for admin class/subject forms that need the list) ---
    @GetMapping("/subjects")
    public List<Map<String, Object>> listSubjects() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Subject s : subjectRepo.findAll()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("name", s.getName());
            m.put("programme", s.getProgramme());
            m.put("isCore", s.isCore());
            result.add(m);
        }
        return result;
    }
}
