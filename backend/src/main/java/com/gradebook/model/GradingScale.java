package com.gradebook.model;

import jakarta.persistence.*;

/**
 * One row of the grading scale: a letter band over a score range, with a
 * remark. Seeded with the WAEC SHS scale (A1-F9). Admins can edit the rows
 * (ranges must not overlap — enforced in AdminController); grade letters
 * are resolved from these rows at read time.
 */
@Entity
@Table(name = "grading_scales")
public class GradingScale {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String letter;
    @Column(nullable = false) private double minScore;
    @Column(nullable = false) private double maxScore;
    private String remark;

    /** The school this scale row belongs to. Null only for pre-upgrade rows (backfilled on boot). */
    @ManyToOne
    @JoinColumn(name = "school_id")
    private School school;

    public GradingScale() {
    }

    public GradingScale(String letter, double minScore, double maxScore, String remark) {
        this.letter = letter;
        this.minScore = minScore;
        this.maxScore = maxScore;
        this.remark = remark;
    }

    public Long getId() { return id; }
    public String getLetter() { return letter; }
    public double getMinScore() { return minScore; }
    public double getMaxScore() { return maxScore; }
    public String getRemark() { return remark; }
    public School getSchool() { return school; }
    public void setId(Long id) { this.id = id; }
    public void setLetter(String l) { this.letter = l; }
    public void setMinScore(double m) { this.minScore = m; }
    public void setMaxScore(double m) { this.maxScore = m; }
    public void setRemark(String r) { this.remark = r; }
    public void setSchool(School s) { this.school = s; }

    /** True when the score falls in this band (boundaries inclusive). */
    public boolean contains(double score) {
        return score >= minScore && score <= maxScore;
    }
}
