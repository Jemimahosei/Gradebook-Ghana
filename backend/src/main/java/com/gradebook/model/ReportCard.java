package com.gradebook.model;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "report_cards")
public class ReportCard {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne @JoinColumn(name = "student_id", nullable = false) private Student student;
    private String semester;
    private double average;
    private int rank;
    private int totalStudents;
    private LocalDateTime generatedAt;

    @PrePersist
    public void prePersist() { generatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public Student getStudent() { return student; }
    public String getSemester() { return semester; }
    public double getAverage() { return average; }
    public int getRank() { return rank; }
    public int getTotalStudents() { return totalStudents; }
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setId(Long id) { this.id = id; }
    public void setStudent(Student s) { this.student = s; }
    public void setSemester(String s) { this.semester = s; }
    public void setAverage(double a) { this.average = a; }
    public void setRank(int r) { this.rank = r; }
    public void setTotalStudents(int t) { this.totalStudents = t; }
}
