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

    /**
     * Admin-controlled per-class publish switch: students only see this
     * class's results when it is true (in addition to the per-grade
     * published flag set by the teacher publish). Defaults to hidden —
     * the admin publishes when the term's results are ready.
     */
    @Column(columnDefinition = "boolean default false")
    private boolean resultsPublished = false;

    /** The school this class belongs to. Null only for pre-upgrade rows (backfilled on boot). */
    @ManyToOne
    @JoinColumn(name = "school_id")
    private School school;

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getProgramme() { return programme; }
    public int getFormYear() { return formYear; }
    public Teacher getClassTeacher() { return classTeacher; }
    public boolean isResultsPublished() { return resultsPublished; }
    public School getSchool() { return school; }
    public void setId(Long id) { this.id = id; }
    public void setName(String n) { this.name = n; }
    public void setProgramme(String p) { this.programme = p; }
    public void setFormYear(int y) { this.formYear = y; }
    public void setClassTeacher(Teacher t) { this.classTeacher = t; }
    public void setResultsPublished(boolean p) { this.resultsPublished = p; }
    public void setSchool(School s) { this.school = s; }
}
