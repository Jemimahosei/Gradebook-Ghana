package com.gradebook.repository;

import com.gradebook.model.GradingScale;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GradingScaleRepository extends JpaRepository<GradingScale, Long> {
    /** Highest band first (A1 at the top). */
    List<GradingScale> findAllByOrderByMinScoreDesc();
}
