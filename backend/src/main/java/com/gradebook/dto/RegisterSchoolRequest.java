package com.gradebook.dto;

/** Public school-signup request: one school plus its first admin account. */
public class RegisterSchoolRequest {
    private String schoolName;
    private String town;
    private String region;
    private String contactName;
    private String email;
    private String password;

    public String getSchoolName() { return schoolName; }
    public String getTown() { return town; }
    public String getRegion() { return region; }
    public String getContactName() { return contactName; }
    public String getEmail() { return email; }
    public String getPassword() { return password; }
    public void setSchoolName(String s) { this.schoolName = s; }
    public void setTown(String t) { this.town = t; }
    public void setRegion(String r) { this.region = r; }
    public void setContactName(String c) { this.contactName = c; }
    public void setEmail(String e) { this.email = e; }
    public void setPassword(String p) { this.password = p; }
}
