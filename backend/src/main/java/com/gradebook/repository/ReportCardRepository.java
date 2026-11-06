package com.gradebook.repository;
import com.gradebook.model.ReportCard;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
public interface ReportCardRepository extends JpaRepository<ReportCard, Long> {
    List<ReportCard> findByStudentId(Long studentId);
    Optional<ReportCard> findByStudentIdAndSemester(Long studentId, String semester);
}
