import com.gradebook.util.RankingUtil;
import com.gradebook.util.WaecGrading;

import java.util.List;

/**
 * Standalone verification for the dependency-free grading utilities.
 * Runs with plain javac/java — no Maven, no Spring, no database — because
 * this VM cannot resolve Maven dependencies (see prototype README).
 *
 * Run:  ./run-verify.sh        (from prototype/backend/verify/)
 * Exit 0 = all checks passed. Any failure prints the check and exits 1.
 */
public class VerifyUtils {

    private static int passed = 0;
    private static int failed = 0;

    private static void check(String name, Object actual, Object expected) {
        boolean ok = (actual == null && expected == null)
                || (actual != null && actual.equals(expected));
        if (ok) {
            passed++;
        } else {
            failed++;
            System.out.println("FAIL: " + name + " — expected <" + expected + "> but got <" + actual + ">");
        }
    }

    private static void checkDouble(String name, Double actual, double expected) {
        boolean ok = actual != null && Math.abs(actual - expected) < 0.0001;
        if (ok) {
            passed++;
        } else {
            failed++;
            System.out.println("FAIL: " + name + " — expected <" + expected + "> but got <" + actual + ">");
        }
    }

    public static void main(String[] args) {
        // ---- WAEC letter boundaries (inclusive at the bottom of each band) ----
        check("letter 100", WaecGrading.letter(100), "A1");
        check("letter 90", WaecGrading.letter(90), "A1");
        check("letter 89.99", WaecGrading.letter(89.99), "B2");
        check("letter 80", WaecGrading.letter(80), "B2");
        check("letter 79.99", WaecGrading.letter(79.99), "B3");
        check("letter 70", WaecGrading.letter(70), "B3");
        check("letter 69.99", WaecGrading.letter(69.99), "C4");
        check("letter 60", WaecGrading.letter(60), "C4");
        check("letter 59.99", WaecGrading.letter(59.99), "C5");
        check("letter 55", WaecGrading.letter(55), "C5");
        check("letter 54.99", WaecGrading.letter(54.99), "C6");
        check("letter 50", WaecGrading.letter(50), "C6");
        check("letter 49.99", WaecGrading.letter(49.99), "D7");
        check("letter 45", WaecGrading.letter(45), "D7");
        check("letter 44.99", WaecGrading.letter(44.99), "E8");
        check("letter 40", WaecGrading.letter(40), "E8");
        check("letter 39.99", WaecGrading.letter(39.99), "F9");
        check("letter 0", WaecGrading.letter(0), "F9");

        // ---- WAEC remarks ----
        check("remark 95", WaecGrading.remark(95), "Excellent");
        check("remark 85", WaecGrading.remark(85), "Very Good");
        check("remark 75", WaecGrading.remark(75), "Good");
        check("remark 62", WaecGrading.remark(62), "Credit");
        check("remark 57", WaecGrading.remark(57), "Credit");
        check("remark 52", WaecGrading.remark(52), "Credit");
        check("remark 47", WaecGrading.remark(47), "Pass");
        check("remark 42", WaecGrading.remark(42), "Pass");
        check("remark 20", WaecGrading.remark(20), "Fail");

        // ---- 30/70 totals ----
        checkDouble("total 80/90", WaecGrading.total(80.0, 90.0), 87.0);   // 24 + 63
        checkDouble("total 100/0", WaecGrading.total(100.0, 0.0), 30.0);
        checkDouble("total 0/100", WaecGrading.total(0.0, 100.0), 70.0);
        checkDouble("total 100/100", WaecGrading.total(100.0, 100.0), 100.0);
        checkDouble("total 50/50", WaecGrading.total(50.0, 50.0), 50.0);
        checkDouble("total 33/77", WaecGrading.total(33.0, 77.0), 63.8);   // 9.9 + 53.9
        check("total null class", WaecGrading.total(null, 90.0), null);
        check("total null exam", WaecGrading.total(80.0, null), null);
        check("total both null", WaecGrading.total(null, null), null);
        check("letter from components 80/90", WaecGrading.letter(80.0, 90.0), "B2");
        check("letter from components null", WaecGrading.letter(null, 90.0), null);

        // ---- score validation ----
        try {
            WaecGrading.validateScore(101.0, "classScore");
            check("validate 101 throws", "no throw", "throw");
        } catch (IllegalArgumentException e) {
            check("validate 101 throws", "throw", "throw");
        }
        try {
            WaecGrading.validateScore(-1.0, "examScore");
            check("validate -1 throws", "no throw", "throw");
        } catch (IllegalArgumentException e) {
            check("validate -1 throws", "throw", "throw");
        }
        WaecGrading.validateScore(0.0, "classScore");
        WaecGrading.validateScore(100.0, "examScore");
        WaecGrading.validateScore(null, "classScore");
        check("validate 0/100/null ok", "ok", "ok");

        // ---- averages ----
        checkDouble("average [80,90]", WaecGrading.average(List.of(80.0, 90.0)), 85.0);
        checkDouble("average [87, 92.5, 70]", WaecGrading.average(List.of(87.0, 92.5, 70.0)), 83.17);
        check("average empty", WaecGrading.average(List.of()), null);
        check("average null list", WaecGrading.average(null), null);
        check("average all null", WaecGrading.average(java.util.Arrays.asList(null, null)), null);
        checkDouble("average skips nulls", WaecGrading.average(java.util.Arrays.asList(80.0, null, 90.0)), 85.0);

        // ---- "1224" ranking ----
        List<RankingUtil.RankedEntry> r1 = RankingUtil.rank(List.of(
                new RankingUtil.StudentAverage(1, "Kwame Mensah", 92.0),
                new RankingUtil.StudentAverage(2, "Abena Osei", 85.0),
                new RankingUtil.StudentAverage(3, "Kofi Acheampong", 85.0),
                new RankingUtil.StudentAverage(4, "Akosua Boateng", 70.0)));
        check("1224 size", r1.size(), 4);
        check("1224 rank[0]", r1.get(0).rank(), 1);
        check("1224 rank[1] tie", r1.get(1).rank(), 2);
        check("1224 rank[2] tie", r1.get(2).rank(), 2);
        check("1224 rank[3] skips to 4", r1.get(3).rank(), 4);

        // three-way tie at the top: 1,1,1,4
        List<RankingUtil.RankedEntry> r2 = RankingUtil.rank(List.of(
                new RankingUtil.StudentAverage(1, "Ama Asare", 90.0),
                new RankingUtil.StudentAverage(2, "Yaw Darko", 90.0),
                new RankingUtil.StudentAverage(3, "Kwesi Amponsah", 90.0),
                new RankingUtil.StudentAverage(4, "Adwoa Frimpong", 60.0)));
        check("top-tie rank[0]", r2.get(0).rank(), 1);
        check("top-tie rank[3] skips to 4", r2.get(3).rank(), 4);

        // null averages excluded; alphabetical tiebreak within a tie group
        List<RankingUtil.RankedEntry> r3 = RankingUtil.rank(List.of(
                new RankingUtil.StudentAverage(1, "Zebra", 88.0),
                new RankingUtil.StudentAverage(2, "Alpha", null),
                new RankingUtil.StudentAverage(3, "Mango", 88.0)));
        check("null excluded size", r3.size(), 2);
        check("tiebreak name first", r3.get(0).studentName(), "Mango");
        check("tiebreak name second", r3.get(1).studentName(), "Zebra");

        // empty / null input
        check("rank empty", RankingUtil.rank(List.of()).size(), 0);
        check("rank null", RankingUtil.rank(null).size(), 0);

        // single student
        List<RankingUtil.RankedEntry> r4 = RankingUtil.rank(List.of(
                new RankingUtil.StudentAverage(9, "Solo", 77.5)));
        check("single rank", r4.get(0).rank(), 1);
        checkDouble("single avg", r4.get(0).average(), 77.5);

        System.out.println("VerifyUtils: " + passed + " passed, " + failed + " failed");
        if (failed > 0) {
            System.exit(1);
        }
    }
}
