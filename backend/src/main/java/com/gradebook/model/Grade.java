package com.gradebook.model;

import com.gradebook.util.WaecGrading;
import jakarta.persistence.*;

/**
 * One student's mark in one subject for one semester.
 *
 * Scoring model (locked by jem, Nov 5, 2026): two components, each out of 100 —
 * class work (30%) and exam (70%). {@code score} is the persisted weighted
 * total, recomputed whenever a component changes. A null component means
 * "not entered yet" and the total is null (shown as blank, never 0).
 */
@Entity
@Table(name = "grades",
       uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "subject_id", "semester"}))
public class Grade {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne @JoinColumn(name = "student_id", nullable = false) private Student student;
    @ManyToOne @JoinColumn(name = "subject_id", nullable = false) private Subject subject;
    @ManyToOne @JoinColumn(name = "teacher_id", nullable = false) private Teacher teacher;

    /** Class work component, 0-100 (counts 30%). Null = not entered. */
    @Column(name = "class_score")
    private Double classScore;

    /** Exam component, 0-100 (counts 70%). Null = not entered. */
    @Column(name = "exam_score")
    private Double examScore;

    /** Weighted total = 0.3 * classScore + 0.7 * examScore, rounded to 2dp. Null when incomplete. */
    private Double score;

    private String semester;
    private boolean published = false;

    public Long getId() { return id; }
    public Student getStudent() { return student; }
    public Subject getSubject() { return subject; }
    public Teacher getTeacher() { return teacher; }
    public Double getClassScore() { return classScore; }
    public Double getExamScore() { return examScore; }
    public Double getScore() { return score; }
    public String getSemester() { return semester; }
    public boolean isPublished() { return published; }
    public void setId(Long id) { this.id = id; }
    public void setStudent(Student s) { this.student = s; }
    public void setSubject(Subject s) { this.subject = s; }
    public void setTeacher(Teacher t) { this.teacher = t; }

    public void setClassScore(Double classScore) {
        WaecGrading.validateScore(classScore, "classScore");
        this.classScore = classScore;
        recomputeTotal();
    }

    public void setExamScore(Double examScore) {
        WaecGrading.validateScore(examScore, "examScore");
        this.examScore = examScore;
        recomputeTotal();
    }

    /** Direct total setter (kept for Hibernate/Jackson); prefer the component setters. */
    public void setScore(Double s) { this.score = s; }
    public void setSemester(String s) { this.semester = s; }
    public void setPublished(boolean p) { this.published = p; }

    private void recomputeTotal() {
        this.score = WaecGrading.total(this.classScore, this.examScore);
    }

    /** WAEC letter grade for the total, or "-" when the grade is incomplete. */
    public String getGrade() {
        return score == null ? "-" : WaecGrading.letter(score);
    }

    public String getRemarks() {
        return score == null ? "-" : WaecGrading.remark(score);
    }
}
