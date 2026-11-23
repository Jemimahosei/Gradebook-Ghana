package com.gradebook.model;

import jakarta.persistence.*;

/**
 * One school term of an academic year, e.g. semester code "2025/2026-1"
 * shown as "Term 1". Terms are per school: the school's OPEN term is its
 * current semester — marks are entered for it, and closing it locks mark
 * entry until another term is opened. Before terms existed the semester
 * was a single server config value (gradebook.semester); that value is
 * still the fallback for schools with no term rows, and the first term
 * row for a school is created from it on demand.
 */
@Entity
@Table(name = "terms",
       uniqueConstraints = @UniqueConstraint(columnNames = {"school_id", "semester"}))
public class Term {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    /** Semester code the grades carry, e.g. "2025/2026-1". */
    @Column(nullable = false) private String semester;

    /** Display name, e.g. "Term 1". */
    @Column(nullable = false) private String name;

    /** Free-text dates as the admin writes them, e.g. "8 September to 12 December". */
    private String dates;

    /** At most one term per school is open at a time (enforced in TermService). */
    private boolean open = false;

    public Long getId() { return id; }
    public School getSchool() { return school; }
    public String getSemester() { return semester; }
    public String getName() { return name; }
    public String getDates() { return dates; }
    public boolean isOpen() { return open; }
    public void setId(Long id) { this.id = id; }
    public void setSchool(School s) { this.school = s; }
    public void setSemester(String s) { this.semester = s; }
    public void setName(String n) { this.name = n; }
    public void setDates(String d) { this.dates = d; }
    public void setOpen(boolean o) { this.open = o; }
}
