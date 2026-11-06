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

    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public String getPassword() { return password; }
    public String getSubject() { return subject; }
    public String getRole() { return role; }
    public void setId(Long id) { this.id = id; }
    public void setFullName(String n) { this.fullName = n; }
    public void setEmail(String e) { this.email = e; }
    public void setPassword(String p) { this.password = p; }
    public void setSubject(String s) { this.subject = s; }
    public void setRole(String r) { this.role = r; }
}
