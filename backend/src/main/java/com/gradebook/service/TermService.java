package com.gradebook.service;

import com.gradebook.config.GradebookProperties;
import com.gradebook.model.School;
import com.gradebook.model.Term;
import com.gradebook.repository.TermRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Per-school terms. The school's OPEN term defines its current semester:
 * mark entry and the teacher/student views all resolve the semester
 * through here instead of reading the server config directly.
 *
 * Compatibility rule: a school with no term rows behaves exactly as the
 * app did before terms existed — the configured semester
 * (gradebook.semester) is current and marks are open. The first time a
 * school's terms are listed or its semester is resolved for the admin
 * terms page, a matching open term row is created from that config
 * value, so the admin page never starts empty.
 */
@Service
public class TermService {

    private final TermRepository terms;
    private final GradebookProperties props;

    public TermService(TermRepository terms, GradebookProperties props) {
        this.terms = terms;
        this.props = props;
    }

    /** All terms of a school, oldest first; creates the config-semester term when none exist. */
    @Transactional
    public List<Term> termsFor(School school) {
        List<Term> list = terms.findBySchoolOrderByIdAsc(school);
        if (list.isEmpty()) {
            list = List.of(createFromConfig(school));
        }
        return list;
    }

    /** Raw terms of a school (no creation) — for semester resolution hot paths. */
    public List<Term> rawTerms(School school) {
        if (school == null) {
            return List.of();
        }
        return terms.findBySchoolOrderByIdAsc(school);
    }

    /**
     * The semester marks and results currently belong to: the open term's
     * semester; if terms exist but none is open, the newest term's (so
     * students still see the closed term's results); if the school has no
     * terms, the configured semester.
     */
    public String currentSemester(School school) {
        List<Term> list = rawTerms(school);
        if (list.isEmpty()) {
            return props.semester();
        }
        return list.stream().filter(Term::isOpen).findFirst()
                .map(Term::getSemester)
                .orElse(list.get(list.size() - 1).getSemester());
    }

    /** The open term of a school, or null when none is open / none exist. */
    public Term openTerm(School school) {
        List<Term> list = rawTerms(school);
        return list.stream().filter(Term::isOpen).findFirst().orElse(null);
    }

    /** Teachers may enter marks only while a term is open (or before terms are set up). */
    public boolean marksOpen(School school) {
        List<Term> list = rawTerms(school);
        return list.isEmpty() || list.stream().anyMatch(Term::isOpen);
    }

    @Transactional
    public Term create(School school, String name, String semester, String dates) {
        String sem = semester == null ? "" : semester.trim();
        if (sem.isEmpty()) {
            throw new IllegalArgumentException("Semester code is required (e.g. 2025/2026-2)");
        }
        if (terms.findBySchoolAndSemester(school, sem).isPresent()) {
            throw new IllegalArgumentException("This school already has a term for " + sem);
        }
        Term t = new Term();
        t.setSchool(school);
        t.setSemester(sem);
        t.setName(name == null || name.isBlank() ? defaultName(sem) : name.trim());
        t.setDates(dates == null || dates.isBlank() ? null : dates.trim());
        t.setOpen(false);
        return terms.save(t);
    }

    @Transactional
    public Term update(School school, Long id, String name, String dates) {
        Term t = requireTerm(school, id);
        if (name != null && !name.isBlank()) {
            t.setName(name.trim());
        }
        if (dates != null) {
            t.setDates(dates.isBlank() ? null : dates.trim());
        }
        return terms.save(t);
    }

    /** Open this term and close every other term of the school (one open term per school). */
    @Transactional
    public Term setOpen(School school, Long id, boolean open) {
        Term t = requireTerm(school, id);
        if (open) {
            for (Term other : terms.findBySchoolOrderByIdAsc(school)) {
                if (!other.getId().equals(id) && other.isOpen()) {
                    other.setOpen(false);
                    terms.save(other);
                }
            }
        }
        t.setOpen(open);
        return terms.save(t);
    }

    public Term requireTerm(School school, Long id) {
        return terms.findById(id)
                .filter(t -> t.getSchool() != null && school != null
                        && t.getSchool().getId().equals(school.getId()))
                .orElseThrow(() -> new java.util.NoSuchElementException("Term not found: " + id));
    }

    private Term createFromConfig(School school) {
        Term t = new Term();
        t.setSchool(school);
        t.setSemester(props.semester());
        t.setName(defaultName(props.semester()));
        t.setOpen(true);
        return terms.save(t);
    }

    /** "2025/2026-2" → "Term 2"; anything else → the code itself. */
    public static String defaultName(String semester) {
        int dash = semester == null ? -1 : semester.lastIndexOf('-');
        if (dash >= 0 && dash < semester.length() - 1) {
            return "Term " + semester.substring(dash + 1);
        }
        return semester == null ? "Term" : semester;
    }
}
