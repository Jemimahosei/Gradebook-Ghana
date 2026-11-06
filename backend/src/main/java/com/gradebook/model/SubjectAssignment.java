package com.gradebook.model;
import jakarta.persistence.*;

@Entity
@Table(name = "subject_assignments",
       uniqueConstraints = @UniqueConstraint(columnNames = {"teacher_id","subject_id","class_id"}))
public class SubjectAssignment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne @JoinColumn(name = "teacher_id", nullable = false)
    private Teacher teacher;

    @ManyToOne @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @ManyToOne @JoinColumn(name = "class_id", nullable = false)
    private SchoolClass schoolClass;

    public Long getId() { return id; }
    public Teacher getTeacher() { return teacher; }
    public Subject getSubject() { return subject; }
    public SchoolClass getSchoolClass() { return schoolClass; }
    public void setId(Long id) { this.id = id; }
    public void setTeacher(Teacher t) { this.teacher = t; }
    public void setSubject(Subject s) { this.subject = s; }
    public void setSchoolClass(SchoolClass c) { this.schoolClass = c; }
}
