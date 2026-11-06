package com.gradebook.util;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Class ranking: standard competition ranking ("1224").
 *
 * Students are sorted by average descending (ties broken alphabetically by
 * name for a stable order). Tied averages share a rank and the next rank
 * skips accordingly: averages [92, 85, 85, 70] rank as [1, 2, 2, 4].
 * Students with no average (null — no grades yet) are excluded.
 *
 * Ties are decided on the average rounded to 2 decimals, which is also the
 * value shown in the UI, so the displayed table and the ranks always agree.
 *
 * Pure functions, no Spring or database dependencies — verifiable with plain
 * {@code javac}/{@code java} (see {@code prototype/backend/verify/}).
 */
public final class RankingUtil {

    private RankingUtil() {
    }

    public record StudentAverage(long studentId, String studentName, Double average) {
    }

    public record RankedEntry(int rank, long studentId, String studentName, Double average) {
    }

    public static List<RankedEntry> rank(List<StudentAverage> inputs) {
        if (inputs == null) {
            return List.of();
        }
        List<StudentAverage> sorted = inputs.stream()
                .filter(s -> s.average() != null)
                .sorted(Comparator
                        .comparing((StudentAverage s) -> WaecGrading.round2(s.average())).reversed()
                        .thenComparing(StudentAverage::studentName, Comparator.nullsLast(String::compareTo)))
                .toList();
        List<RankedEntry> result = new ArrayList<>();
        int rank = 0;
        Double previousAverage = null;
        for (int i = 0; i < sorted.size(); i++) {
            StudentAverage s = sorted.get(i);
            double rounded = WaecGrading.round2(s.average());
            if (previousAverage == null || Double.compare(rounded, previousAverage) != 0) {
                rank = i + 1; // rank = position of the first student in the tie group
                previousAverage = rounded;
            }
            result.add(new RankedEntry(rank, s.studentId(), s.studentName(), rounded));
        }
        return result;
    }
}
