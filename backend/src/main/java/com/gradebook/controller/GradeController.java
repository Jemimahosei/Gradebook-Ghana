package com.gradebook.controller;

import com.gradebook.config.GradebookProperties;
import com.gradebook.dto.GradeRequest;
import com.gradebook.model.Grade;
import com.gradebook.model.Student;
import com.gradebook.model.Subject;
import com.gradebook.model.Teacher;
import com.gradebook.repository.GradeRepository;
import com.gradebook.repository.StudentRepository;
import com.gradebook.repository.SubjectRepository;
import com.gradebook.repository.TeacherRepository;
import com.gradebook.service.CurrentUserService;
import com.gradebook.service.GradeService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Grade read + batch save. The batch endpoint attributes grades to the
 * authenticated teacher (the original code used the first teacher in the
 * database — fixed). Unknown subjects are rejected, not auto-created:
 * subjects are managed by the admin.
 */
@RestController
@RequestMapping("/api/grades")
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class GradeController {
    private final GradeRepository gradeRepo;
    private final StudentRepository studentRepo;
    private final SubjectRepository subjectRepo;
    private final TeacherRepository teacherRepo;
    private final GradeService gradeService;
    private final CurrentUserService current;
    private final GradebookProperties props;

    public GradeController(GradeRepository gradeRepo, StudentRepository studentRepo,
                           SubjectRepository subjectRepo, TeacherRepository teacherRepo,
                           GradeService gradeService, CurrentUserService current,
                           GradebookProperties props) {
        this.gradeRepo = gradeRepo;
        this.studentRepo = studentRepo;
        this.subjectRepo = subjectRepo;
        this.teacherRepo = teacherRepo;
        this.gradeService = gradeService;
        this.current = current;
        this.props = props;
    }

    @GetMapping
    public List<Map<String, Object>> getAll() {
        List<Grade> grades = gradeRepo.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Grade g : grades) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", g.getId());
            m.put("studentId", g.getStudent().getId());
            m.put("subject", g.getSubject().getName());
            m.put("classScore", g.getClassScore());
            m.put("examScore", g.getExamScore());
            m.put("score", g.getScore());
            m.put("semester", g.getSemester());
            m.put("published", g.isPublished());
            result.add(m);
        }
        return result;
    }

    @PostMapping("/batch")
    public Map<String, Object> saveBatch(Authentication auth, @RequestBody List<GradeRequest> requests) {
        Teacher teacher = current.currentTeacher(auth);
        String semester = props.semester();
        int saved = 0;
        for (GradeRequest req : requests) {
            Subject subject = subjectRepo.findByName(req.getSubject())
                    .orElseThrow(() -> new IllegalArgumentException("Unknown subject: " + req.getSubject()));
            gradeService.enterGrade(req.getStudentId(), subject.getId(), teacher,
                    req.getClassScore(), req.getExamScore(), semester);
            saved++;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "saved");
        result.put("count", saved);
        return result;
    }
}
