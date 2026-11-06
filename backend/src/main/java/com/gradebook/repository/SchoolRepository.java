package com.gradebook.repository;

import com.gradebook.model.School;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SchoolRepository extends JpaRepository<School, Long> {
    Optional<School> findByName(String name);
    Optional<School> findFirstByDemoTrue();
    Optional<School> findFirstByOrderByIdAsc();
}
