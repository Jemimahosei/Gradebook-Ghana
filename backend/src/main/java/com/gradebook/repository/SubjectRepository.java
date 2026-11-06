package com.gradebook.repository;
import com.gradebook.model.Subject;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
public interface SubjectRepository extends JpaRepository<Subject, Long> {
    List<Subject> findByProgramme(String programme);
    Optional<Subject> findByName(String name);
}
