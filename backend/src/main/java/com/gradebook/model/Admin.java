package com.gradebook.model;

import jakarta.persistence.*;

/**
 * School administrator (Academic Head). Admins log in with an email +
 * password and manage classes, subjects, students, the grading scale and
 * the school profile. Separate table from Teacher — the original code had
 * no admin role at all.
 */
@Entity
@Table(name = "admins")
public class Admin {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String fullName;
    @Column(unique = true, nullable = false) private String email;
    @Column(nullable = false) private String password; // BCrypt hash
    private String role = "ADMIN";

    /** The school this admin manages. Null only for pre-upgrade rows (backfilled on boot). */
    @ManyToOne
    @JoinColumn(name = "school_id")
    private School school;

    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public String getPassword() { return password; }
    public String getRole() { return role; }
    public School getSchool() { return school; }
    public void setId(Long id) { this.id = id; }
    public void setFullName(String n) { this.fullName = n; }
    public void setEmail(String e) { this.email = e; }
    public void setPassword(String p) { this.password = p; }
    public void setRole(String r) { this.role = r; }
    public void setSchool(School s) { this.school = s; }
}
