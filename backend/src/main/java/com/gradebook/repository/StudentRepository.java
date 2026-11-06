package com.gradebook.repository;

import com.gradebook.model.SchoolClass;
import com.gradebook.model.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface StudentRepository extends JpaRepository<Student, Long> {
    Optional<Student> findByIndexNumber(String indexNumber);
    List<Student> findBySchoolClass(SchoolClass schoolClass);
}
