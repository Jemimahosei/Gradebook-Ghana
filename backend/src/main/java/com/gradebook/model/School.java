package com.gradebook.model;

import jakarta.persistence.*;

/**
 * The school's identity, used for report-card headers and the admin
 * profile form. The prototype is a single-school demo, so there is
 * normally exactly one row ("Demo Senior High School").
 */
@Entity
@Table(name = "schools")
public class School {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String name;
    private String region;
    private String address;
    private String email;
    private String phone;

    public School() {
    }

    public School(String name, String region) {
        this.name = name;
        this.region = region;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getRegion() { return region; }
    public String getAddress() { return address; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public void setId(Long id) { this.id = id; }
    public void setName(String n) { this.name = n; }
    public void setRegion(String r) { this.region = r; }
    public void setAddress(String a) { this.address = a; }
    public void setEmail(String e) { this.email = e; }
    public void setPhone(String p) { this.phone = p; }
}
