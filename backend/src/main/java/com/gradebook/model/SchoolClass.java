package com.gradebook.model;
import jakarta.persistence.*;

@Entity
@Table(name = "school_classes")
public class SchoolClass {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false) private String name;        // e.g. "Science 1A"
    @Column(nullable = false) private String programme;   // SCIENCE, ARTS, VISUAL_ARTS, HOME_ECONS
    @Column(nullable = false) private int formYear;       // 1, 2, or 3

    @ManyToOne
    @JoinColumn(name = "class_teacher_id")
    private Teacher classTeacher;

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getProgramme() { return programme; }
    public int getFormYear() { return formYear; }
    public Teacher getClassTeacher() { return classTeacher; }
    public void setId(Long id) { this.id = id; }
    public void setName(String n) { this.name = n; }
    public void setProgramme(String p) { this.programme = p; }
    public void setFormYear(int y) { this.formYear = y; }
    public void setClassTeacher(Teacher t) { this.classTeacher = t; }
}
