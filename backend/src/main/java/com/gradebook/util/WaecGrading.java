package com.gradebook.util;

/**
 * WAEC SHS grading + the 30% class work / 70% exam split.
 *
 * Pure functions, no Spring or database dependencies — so they can be
 * verified with plain {@code javac}/{@code java} in this VM (see
 * {@code prototype/backend/verify/}) and reused by the Spring services.
 *
 * Scale (locked by jem, Nov 5, 2026):
 *   90-100 A1 Excellent · 80-89 B2 Very Good · 70-79 B3 Good ·
 *   60-69 C4 Credit · 55-59 C5 Credit · 50-54 C6 Credit ·
 *   45-49 D7 Pass · 40-44 E8 Pass · 0-39 F9 Fail
 * Boundaries are inclusive at the bottom of each band: 90.0 is A1, 89.99 is B2.
 */
public final class WaecGrading {

    private WaecGrading() {
    }

    public static final double CLASS_WEIGHT = 0.30;
    public static final double EXAM_WEIGHT = 0.70;

    /** Total score = 30% class work + 70% exam, rounded to 2 decimals. Null when either component is missing. */
    public static Double total(Double classScore, Double examScore) {
        if (classScore == null || examScore == null) {
            return null;
        }
        return round2(classScore * CLASS_WEIGHT + examScore * EXAM_WEIGHT);
    }

    /** WAEC letter grade for a total score out of 100. */
    public static String letter(double total) {
        if (total >= 90) return "A1";
        if (total >= 80) return "B2";
        if (total >= 70) return "B3";
        if (total >= 60) return "C4";
        if (total >= 55) return "C5";
        if (total >= 50) return "C6";
        if (total >= 45) return "D7";
        if (total >= 40) return "E8";
        return "F9";
    }

    /** Remark for a total score out of 100. */
    public static String remark(double total) {
        if (total >= 90) return "Excellent";
        if (total >= 80) return "Very Good";
        if (total >= 70) return "Good";
        if (total >= 60) return "Credit";
        if (total >= 55) return "Credit";
        if (total >= 50) return "Credit";
        if (total >= 45) return "Pass";
        if (total >= 40) return "Pass";
        return "Fail";
    }

    /** Letter grade from the two components, or null when either is missing. */
    public static String letter(Double classScore, Double examScore) {
        Double t = total(classScore, examScore);
        return t == null ? null : letter(t);
    }

    /** Mean of totals; empty or all-null input returns null, never 0. */
    public static Double average(java.util.List<Double> totals) {
        if (totals == null) {
            return null;
        }
        double sum = 0;
        int count = 0;
        for (Double t : totals) {
            if (t != null) {
                sum += t;
                count++;
            }
        }
        if (count == 0) {
            return null;
        }
        return round2(sum / count);
    }

    public static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    public static Double round2OrNull(Double value) {
        return value == null ? null : round2(value);
    }

    /** A score component must be between 0 and 100 inclusive. */
    public static void validateScore(Double score, String field) {
        if (score == null) {
            return; // missing component is allowed; total is then null
        }
        if (score < 0 || score > 100) {
            throw new IllegalArgumentException(field + " must be between 0 and 100, got " + score);
        }
    }
}
