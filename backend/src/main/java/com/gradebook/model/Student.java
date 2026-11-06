package com.gradebook.model;
import jakarta.persistence.*;

@Entity
@Table(name = "students")
public class Student {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String fullName;
    @Column(unique = true, nullable = false) private String indexNumber;
    @Column(nullable = false) private String password;
    private String programme;
    private int year;
    private String role = "STUDENT";

    @ManyToOne
    @JoinColumn(name = "class_id")
    private SchoolClass schoolClass;

    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public String getIndexNumber() { return indexNumber; }
    public String getPassword() { return password; }
    public String getProgramme() { return programme; }
    public int getYear() { return year; }
    public String getRole() { return role; }
    public SchoolClass getSchoolClass() { return schoolClass; }
    public void setId(Long id) { this.id = id; }
    public void setFullName(String n) { this.fullName = n; }
    public void setIndexNumber(String i) { this.indexNumber = i; }
    public void setPassword(String p) { this.password = p; }
    public void setProgramme(String p) { this.programme = p; }
    public void setYear(int y) { this.year = y; }
    public void setRole(String r) { this.role = r; }
    public void setSchoolClass(SchoolClass c) { this.schoolClass = c; }
}
