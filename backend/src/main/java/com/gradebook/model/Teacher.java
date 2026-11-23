package com.gradebook.model;
import jakarta.persistence.*;

@Entity
@Table(name = "teachers")
public class Teacher {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String fullName;
    @Column(unique = true, nullable = false) private String email;
    @Column(nullable = false) private String password;
    private String subject;
    private String role = "TEACHER";
    /** True while on an admin-issued password — see Student.mustChangePassword. */
    private boolean mustChangePassword = false;

    /** The school this teacher works for. Null only for pre-upgrade rows (backfilled on boot). */
    @ManyToOne
    @JoinColumn(name = "school_id")
    private School school;

    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public String getPassword() { return password; }
    public String getSubject() { return subject; }
    public String getRole() { return role; }
    public boolean isMustChangePassword() { return mustChangePassword; }
    public School getSchool() { return school; }
    public void setId(Long id) { this.id = id; }
    public void setFullName(String n) { this.fullName = n; }
    public void setEmail(String e) { this.email = e; }
    public void setPassword(String p) { this.password = p; }
    public void setSubject(String s) { this.subject = s; }
    public void setRole(String r) { this.role = r; }
    public void setMustChangePassword(boolean m) { this.mustChangePassword = m; }
    public void setSchool(School s) { this.school = s; }
}
