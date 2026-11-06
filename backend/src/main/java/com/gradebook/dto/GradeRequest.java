package com.gradebook.dto;

/**
 * One row of a batch grade save: a student's class-work (30%) and exam
 * (70%) components for one subject. Either component may be null (not
 * entered yet); the total is then null until both are present.
 * The legacy single {@code score} field is accepted for backwards
 * compatibility and treated as the exam component when no components
 * are supplied.
 */
public class GradeRequest {
    private Long studentId;
    private String subject;
    private Double classScore;
    private Double examScore;
    private Double score;

    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public Double getClassScore() { return classScore; }
    public void setClassScore(Double classScore) { this.classScore = classScore; }
    public Double getExamScore() {
        if (examScore != null) {
            return examScore;
        }
        return score; // legacy single-score payloads map onto the exam component
    }
    public void setExamScore(Double examScore) { this.examScore = examScore; }
    public Double getScore() { return score; }
    public void setScore(Double score) { this.score = score; }
}
