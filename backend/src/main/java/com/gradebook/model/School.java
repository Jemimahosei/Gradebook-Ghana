package com.gradebook.model;

import jakarta.persistence.*;

/**
 * A school registered on Gradebook Ghana. The prototype started as a
 * single-school demo ("Demo Senior High School", demo=true); real schools
 * register through the public signup and get their own isolated data.
 * Every school-scoped record (admins, teachers, classes, subjects,
 * students, grading scales) carries a school_id; grades and report cards
 * belong to a school through their student.
 */
@Entity
@Table(name = "schools")
public class School {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String name;
    private String town;
    private String region;
    private String address;
    private String email;
    private String phone;
    /** True only for the seeded demo school. Demo data is fictional. */
    private boolean demo = false;

    public School() {
    }

    public School(String name, String region) {
        this.name = name;
        this.region = region;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getTown() { return town; }
    public String getRegion() { return region; }
    public String getAddress() { return address; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public boolean isDemo() { return demo; }
    public void setId(Long id) { this.id = id; }
    public void setName(String n) { this.name = n; }
    public void setTown(String t) { this.town = t; }
    public void setRegion(String r) { this.region = r; }
    public void setAddress(String a) { this.address = a; }
    public void setEmail(String e) { this.email = e; }
    public void setPhone(String p) { this.phone = p; }
    public void setDemo(boolean d) { this.demo = d; }
}
