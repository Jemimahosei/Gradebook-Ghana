package com.gradebook.repository;

import com.gradebook.model.School;
import com.gradebook.model.Term;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TermRepository extends JpaRepository<Term, Long> {
    List<Term> findBySchoolOrderByIdAsc(School school);
    Optional<Term> findBySchoolAndSemester(School school, String semester);
    Optional<Term> findBySchoolAndOpenTrue(School school);
}
