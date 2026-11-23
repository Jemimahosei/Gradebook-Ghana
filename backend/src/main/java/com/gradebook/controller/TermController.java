package com.gradebook.controller;

import com.gradebook.model.School;
import com.gradebook.model.Term;
import com.gradebook.service.CurrentUserService;
import com.gradebook.service.TermService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Terms admin (mockup screen 18) plus the shared school-context read.
 *
 * Admin endpoints manage the logged-in admin's school's terms: list,
 * create, rename, open and close. Opening a term closes the school's
 * other terms, and while no term is open teachers cannot enter marks
 * (enforced in GradeController). The context endpoint gives every
 * logged-in user their school's current term and mark weighting, which
 * the teacher UI needs for its live totals.
 */
@RestController
@RequestMapping("/api")
public class TermController {

    private final CurrentUserService current;
    private final TermService termService;

    public TermController(CurrentUserService current, TermService termService) {
        this.current = current;
        this.termService = termService;
    }

    public record TermRequest(String name, String semester, String dates) {
    }

    private Map<String, Object> termDto(Term t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("name", t.getName());
        m.put("semester", t.getSemester());
        m.put("dates", t.getDates());
        m.put("open", t.isOpen());
        return m;
    }

    // ---- admin: term management ----

    @GetMapping("/admin/terms")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> listTerms(Authentication auth) {
        School school = current.currentSchool(auth);
        return termService.termsFor(school).stream().map(this::termDto).toList();
    }

    @PostMapping("/admin/terms")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> createTerm(Authentication auth, @RequestBody TermRequest body) {
        School school = current.currentSchool(auth);
        return termDto(termService.create(school, body.name(), body.semester(), body.dates()));
    }

    @PutMapping("/admin/terms/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> updateTerm(Authentication auth, @PathVariable Long id,
                                          @RequestBody TermRequest body) {
        School school = current.currentSchool(auth);
        return termDto(termService.update(school, id, body.name(), body.dates()));
    }

    @PostMapping("/admin/terms/{id}/open")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> openTerm(Authentication auth, @PathVariable Long id) {
        School school = current.currentSchool(auth);
        return termDto(termService.setOpen(school, id, true));
    }

    @PostMapping("/admin/terms/{id}/close")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> closeTerm(Authentication auth, @PathVariable Long id) {
        School school = current.currentSchool(auth);
        return termDto(termService.setOpen(school, id, false));
    }

    // ---- shared: the caller's school context ----

    /**
     * Current term + mark weighting for the logged-in user's school.
     * Used by the teacher UI (live totals use the school's weighting)
     * and anywhere the current term needs showing.
     */
    @GetMapping("/context")
    public Map<String, Object> context(Authentication auth) {
        School school = current.currentSchool(auth);
        Term open = termService.openTerm(school);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("semester", termService.currentSemester(school));
        m.put("termName", open == null ? null : open.getName());
        m.put("termOpen", termService.marksOpen(school));
        m.put("classWeightPercent", school.getClassWeightPercent());
        m.put("examWeightPercent", school.getExamWeightPercent());
        return m;
    }
}
