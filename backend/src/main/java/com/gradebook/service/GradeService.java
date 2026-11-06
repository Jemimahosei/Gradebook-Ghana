package com.gradebook.service;

import com.gradebook.model.Grade;
import com.gradebook.model.ReportCard;
import com.gradebook.model.School;
import com.gradebook.model.SchoolClass;
import com.gradebook.model.Student;
import com.gradebook.model.Subject;
import com.gradebook.model.Teacher;
import com.gradebook.repository.GradeRepository;
import com.gradebook.repository.ReportCardRepository;
import com.gradebook.repository.StudentRepository;
import com.gradebook.repository.SubjectRepository;
import com.gradebook.repository.TeacherRepository;
import com.gradebook.util.RankingUtil;
import com.gradebook.util.WaecGrading;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;

/**
 * Grade arithmetic and report cards. All pure maths lives in
 * {@link WaecGrading} / {@link RankingUtil} (verified standalone); this
 * service is the Spring/JPA wiring around them.
 */
@Service
public class GradeService {

    private final GradeRepository gradeRepo;
    private final StudentRepository studentRepo;
    private final SubjectRepository subjectRepo;
    private final TeacherRepository teacherRepo;
    private final ReportCardRepository reportCardRepo;

    public GradeService(GradeRepository gradeRepo, StudentRepository studentRepo,
                        SubjectRepository subjectRepo, TeacherRepository teacherRepo,
                        ReportCardRepository reportCardRepo) {
        this.gradeRepo = gradeRepo;
        this.studentRepo = studentRepo;
        this.subjectRepo = subjectRepo;
        this.teacherRepo = teacherRepo;
        this.reportCardRepo = reportCardRepo;
    }

    /** Create or update one student's grade in one subject (30/70 components).
     * All three parties must belong to the same school — a teacher can only
     * grade their own school's students in their own school's subjects. */
    public Grade enterGrade(Long studentId, Long subjectId, Teacher teacher,
                            Double classScore, Double examScore, String semester) {
        WaecGrading.validateScore(classScore, "classScore");
        WaecGrading.validateScore(examScore, "examScore");
        Student student = studentRepo.findById(studentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found: " + studentId));
        Subject subject = subjectRepo.findById(subjectId)
                .orElseThrow(() -> new IllegalArgumentException("Subject not found: " + subjectId));
        if (!sameSchool(teacher, student, subject)) {
            throw new NoSuchElementException("Student or subject not found in your school");
        }
        Grade grade = gradeRepo.findByStudentAndSubjectAndSemester(student, subject, semester)
                .orElseGet(Grade::new);
        grade.setStudent(student);
        grade.setSubject(subject);
        grade.setTeacher(teacher);
        grade.setClassScore(classScore);
        grade.setExamScore(examScore);
        grade.setSemester(semester);
        return gradeRepo.save(grade);
    }

    /** True when teacher, student and subject all belong to the same school. */
    private boolean sameSchool(Teacher teacher, Student student, Subject subject) {
        Long teacherSchool = teacher.getSchool() == null ? null : teacher.getSchool().getId();
        if (teacherSchool == null) {
            return false; // cannot happen after the startup backfill
        }
        School studentSchool = student.getSchool() != null ? student.getSchool()
                : (student.getSchoolClass() == null ? null : student.getSchoolClass().getSchool());
        Long studentSchoolId = studentSchool == null ? null : studentSchool.getId();
        Long subjectSchoolId = subject.getSchool() == null ? null : subject.getSchool().getId();
        return Objects.equals(teacherSchool, studentSchoolId)
                && Objects.equals(teacherSchool, subjectSchoolId);
    }

    /** A student's published grades (what the student dashboard shows). */
    public List<Grade> getPublishedGrades(Long studentId) {
        return gradeRepo.findByStudentIdAndPublishedTrue(studentId);
    }

    /** A student's average across their (complete) grades; null when none. */
    public Double studentAverage(Long studentId, String semester) {
        List<Grade> grades = gradeRepo.findByStudentIdAndSemester(studentId, semester);
        return WaecGrading.average(grades.stream().map(Grade::getScore).toList());
    }

    /** "1224" rankings for every student in a class, by average descending. */
    public List<RankingUtil.RankedEntry> classRankings(SchoolClass schoolClass, String semester) {
        List<Student> roster = studentRepo.findBySchoolClass(schoolClass);
        List<RankingUtil.StudentAverage> inputs = roster.stream()
                .map(s -> new RankingUtil.StudentAverage(
                        s.getId(), s.getFullName(), studentAverage(s.getId(), semester)))
                .toList();
        return RankingUtil.rank(inputs);
    }

    /** Rank of one student inside their class, or null when unranked (no grades). */
    public Integer classRank(Long studentId, String semester) {
        Student student = studentRepo.findById(studentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found: " + studentId));
        if (student.getSchoolClass() == null) {
            return null;
        }
        return classRankings(student.getSchoolClass(), semester).stream()
                .filter(e -> e.studentId() == studentId)
                .map(RankingUtil.RankedEntry::rank)
                .findFirst().orElse(null);
    }

    /** (Re)generate and store the report-card row for one student. */
    public ReportCard generateReportCard(Long studentId, String semester) {
        Student student = studentRepo.findById(studentId)
                .orElseThrow(() -> new IllegalArgumentException("Student not found: " + studentId));
        List<Grade> grades = gradeRepo.findByStudentIdAndSemester(studentId, semester);
        if (grades.isEmpty()) {
            throw new IllegalArgumentException("No grades found for this student");
        }
        Double average = WaecGrading.average(grades.stream().map(Grade::getScore).toList());
        Integer rank = classRank(studentId, semester);
        int totalStudents = student.getSchoolClass() == null ? 0
                : studentRepo.findBySchoolClass(student.getSchoolClass()).size();

        ReportCard card = reportCardRepo.findByStudentIdAndSemester(studentId, semester)
                .orElse(new ReportCard());
        card.setStudent(student);
        card.setSemester(semester);
        card.setAverage(average == null ? 0.0 : average);
        card.setRank(rank == null ? 0 : rank);
        card.setTotalStudents(totalStudents);
        return reportCardRepo.save(card);
    }
}
