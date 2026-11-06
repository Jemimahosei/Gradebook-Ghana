package com.gradebook.service;

import com.gradebook.model.School;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * One-time backfill for the multi-school upgrade, run on every boot
 * (cheap no-op once done). Before the upgrade there was exactly one
 * school and no school_id columns; the new columns are added by
 * ddl-auto=update as NULL, so every pre-upgrade row must be assigned to
 * the demo school:
 *
 * <ul>
 *   <li>The school named "Demo Senior High School" is marked demo=true
 *       (the new column defaults to false on existing rows).</li>
 *   <li>Admins, teachers, classes, subjects and grading-scale rows with
 *       a NULL school get the demo school.</li>
 *   <li>Students with a NULL school inherit their class's school, or the
 *       demo school when they have no class.</li>
 * </ul>
 *
 * Runs before the DataSeeder (@Order(1) vs @Order(2)); on a fresh
 * database there is no school yet and this is a no-op.
 */
@Component
@Order(1)
@Transactional
public class SchoolBackfill implements CommandLineRunner {

    @PersistenceContext
    private EntityManager em;

    @Override
    public void run(String... args) {
        List<School> schools = em.createQuery(
                "SELECT s FROM School s ORDER BY s.id", School.class).getResultList();
        if (schools.isEmpty()) {
            return; // fresh database — the seeder creates the demo school
        }
        School demo = schools.stream().filter(School::isDemo).findFirst()
                .orElseGet(() -> schools.stream()
                        .filter(s -> "Demo Senior High School".equals(s.getName()))
                        .findFirst().orElse(schools.get(0)));
        if (!demo.isDemo()) {
            demo.setDemo(true);
            em.merge(demo);
        }

        int classes = bulk("UPDATE SchoolClass c SET c.school = :s WHERE c.school IS NULL", demo);
        int admins = bulk("UPDATE Admin a SET a.school = :s WHERE a.school IS NULL", demo);
        int teachers = bulk("UPDATE Teacher t SET t.school = :s WHERE t.school IS NULL", demo);
        int subjects = bulk("UPDATE Subject s SET s.school = :s WHERE s.school IS NULL", demo);
        int scales = bulk("UPDATE GradingScale g SET g.school = :s WHERE g.school IS NULL", demo);

        // Students first inherit their class's school, then fall back to demo.
        // (Done as a Java loop, not a bulk UPDATE: HQL bulk updates cannot
        // assign from a joined path like st.schoolClass.school.)
        List<com.gradebook.model.Student> fromClassStudents = em.createQuery(
                        "SELECT st FROM Student st WHERE st.school IS NULL " +
                        "AND st.schoolClass IS NOT NULL AND st.schoolClass.school IS NOT NULL",
                        com.gradebook.model.Student.class).getResultList();
        for (com.gradebook.model.Student st : fromClassStudents) {
            st.setSchool(st.getSchoolClass().getSchool());
        }
        int fromClass = fromClassStudents.size();
        int students = bulk("UPDATE Student st SET st.school = :s WHERE st.school IS NULL", demo);

        int total = classes + admins + teachers + subjects + scales + fromClass + students;
        if (total > 0) {
            System.out.println("SchoolBackfill: assigned " + total + " pre-upgrade rows to "
                    + demo.getName() + " (classes=" + classes + ", admins=" + admins
                    + ", teachers=" + teachers + ", subjects=" + subjects + ", scales=" + scales
                    + ", students=" + (fromClass + students) + ")");
        }
    }

    private int bulk(String jpql, School school) {
        return em.createQuery(jpql).setParameter("s", school).executeUpdate();
    }
}
