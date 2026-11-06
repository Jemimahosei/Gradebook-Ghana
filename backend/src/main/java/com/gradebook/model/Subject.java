package com.gradebook.model;
import jakarta.persistence.*;

@Entity
@Table(name = "subjects")
public class Subject {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String name;
    private String programme;
    private boolean isCore;

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getProgramme() { return programme; }
    public boolean isCore() { return isCore; }
    public void setId(Long id) { this.id = id; }
    public void setName(String n) { this.name = n; }
    public void setProgramme(String p) { this.programme = p; }
    public void setCore(boolean c) { this.isCore = c; }
}
